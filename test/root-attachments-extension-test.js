/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')

describe('root-attachments-extension', () => {
  const ext = require(packageName + '/root-attachments-extension')

  const createContentCatalog = () => ({
    files: [],
    component: { versions: [] },
    findByArgs: {},
    findBy (args) {
      this.findByArgs = args
      return this.files
    },
    getComponent () {
      return this.component
    },
  })

  const createGeneratorContext = () => ({
    variables: {},
    once (eventName, fn) {
      this[eventName] = fn
    },
    updateVariables (updates) {
      Object.assign(this.variables, updates)
    },
  })

  const contentClassified = (config = { rootComponentName: 'framework' }) => {
    ext.register.call(generatorContext, config ? { config } : {})
    return generatorContext.contentClassified({ contentCatalog })
  }

  let generatorContext
  let contentCatalog

  beforeEach(() => {
    generatorContext = createGeneratorContext()
    contentCatalog = createContentCatalog()
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call(generatorContext, {})
      expect(generatorContext.contentClassified).to.be.instanceOf(Function)
    })
  })

  describe('contentClassified', () => {
    it("findBy uses { family: 'attachment' }", () => {
      contentClassified()
      expect(contentCatalog.findByArgs).is.eqls({ family: 'attachment' })
    })
    describe('file.pub', () => {
      it('file.pub ROOT module', () => {
        contentCatalog.files.push({
          pub: {
            url: '/_attachments/api/java/org/springframework/security/core/Authentication.html',
            moduleRootPath: '../../../../../..',
            rootPath: '../../../../../../..',
          },
        })
        contentClassified()
        expect(contentCatalog.files).is.eqls([
          {
            pub: {
              url: '/api/java/org/springframework/security/core/Authentication.html',
              moduleRootPath: '../../../../..',
              rootPath: '../../../../../..',
            },
          },
        ])
      })
      it('file.pub named module', () => {
        contentCatalog.files.push({
          pub: {
            url: '/java-project/_attachments/api/java/org/springframework/security/core/Authentication.html',
            moduleRootPath: '../../../../../../..',
            rootPath: '../../../../../../../..',
          },
        })
        contentClassified()
        expect(contentCatalog.files).is.eqls([
          {
            pub: {
              url: '/java-project/api/java/org/springframework/security/core/Authentication.html',
              moduleRootPath: '../../../../../..',
              rootPath: '../../../../../../..',
            },
          },
        ])
      })
      it('file.pub named module no path', () => {
        contentCatalog.files.push({
          pub: {
            url: '/java-project/_attachments/index.html',
            moduleRootPath: '..',
            rootPath: '../..',
          },
        })
        contentClassified()
        expect(contentCatalog.files).is.eqls([
          {
            pub: {
              url: '/java-project/index.html',
              moduleRootPath: '.',
              rootPath: '..',
            },
          },
        ])
      })
      it('file.pub ROOT module no path', () => {
        contentCatalog.files.push({
          pub: {
            url: '/_attachments/index.html',
            moduleRootPath: '..',
            rootPath: '../..',
          },
        })
        contentClassified()
        expect(contentCatalog.files).is.eqls([
          {
            pub: {
              url: '/index.html',
              moduleRootPath: '.',
              rootPath: '..',
            },
          },
        ])
      })
      it('file.pub null rootPath', () => {
        contentCatalog.files.push({
          pub: {
            url: '/_attachments/api/java/org/springframework/security/core/Authentication.html',
            moduleRootPath: '../../../../../..',
          },
        })
        contentClassified()
        expect(contentCatalog.files).is.eqls([
          {
            pub: {
              url: '/api/java/org/springframework/security/core/Authentication.html',
              moduleRootPath: '../../../../..',
            },
          },
        ])
      })
      it('file.pub null moduleRootPath', () => {
        contentCatalog.files.push({
          pub: {
            url: '/_attachments/api/java/org/springframework/security/core/Authentication.html',
            rootPath: '../../../../../../..',
          },
        })
        contentClassified()
        expect(contentCatalog.files).is.eqls([
          {
            pub: {
              url: '/api/java/org/springframework/security/core/Authentication.html',
              rootPath: '../../../../../..',
            },
          },
        ])
      })
    })
    describe('file.out', () => {
      it('file.out ROOT module', () => {
        contentCatalog.files.push({
          out: {
            dirname: '_attachments/api/java/org/springframework/security/core',
            basename: 'Authentication.html',
            path: '_attachments/api/java/porg/springframework/security/core/Authentication.html',
            moduleRootPath: '../../../../../..',
            rootPath: '../../../../../../..',
          },
        })
        contentClassified()
        expect(contentCatalog.files).is.eqls([
          {
            out: {
              dirname: 'api/java/org/springframework/security/core',
              basename: 'Authentication.html',
              path: 'api/java/porg/springframework/security/core/Authentication.html',
              moduleRootPath: '../../../../..',
              rootPath: '../../../../../..',
            },
          },
        ])
      })
      it('file.out named module', () => {
        contentCatalog.files.push({
          out: {
            dirname: 'java-project/_attachments/api/java/org/springframework/security/core',
            basename: 'Authentication.html',
            path: 'java-project/_attachments/api/java/porg/springframework/security/core/Authentication.html',
            moduleRootPath: '../../../../../../..',
            rootPath: '../../../../../../../..',
          },
        })
        contentClassified()
        expect(contentCatalog.files).is.eqls([
          {
            out: {
              dirname: 'java-project/api/java/org/springframework/security/core',
              basename: 'Authentication.html',
              path: 'java-project/api/java/porg/springframework/security/core/Authentication.html',
              moduleRootPath: '../../../../../..',
              rootPath: '../../../../../../..',
            },
          },
        ])
      })
    })
  })
})
