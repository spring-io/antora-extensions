/* eslint-env mocha */
'use strict'

const { cleanDir, expect, filterLines, heredoc, spy } = require('./harness')
const ospath = require('node:path')
const { name: packageName } = require('#package')

const WORK_DIR = ospath.join(__dirname, 'work')

describe('tabs-migration-extension', () => {
  const ext = require(packageName + '/tabs-migration-extension')

  const SAMPLE_OLD_TABS = heredoc`
  .Ruby
  [,ruby,role="primary"]
  ----
  puts 1
  ----

  .JavaScript
  [,js,role="secondary"]
  ----
  console.log(1)
  ----
  `

  const SAMPLE_OLD_TABS_INVERTED = heredoc`
  [,ruby,role="primary"]
  .Ruby
  ----
  puts 1
  ----

  [,js,role="secondary"]
  .JavaScript
  ----
  console.log(1)
  ----
  `

  const SAMPLE_NEW_TABS = heredoc`
  [tabs]
  ======
  Ruby::
  +
  [,ruby,role="primary"]
  ----
  puts 1
  ----

  JavaScript::
  +
  [,js,role="secondary"]
  ----
  console.log(1)
  ----
  ======
  `

  const addPage = (contents, publishable = true) => {
    contents = Buffer.from(contents)
    const mediaType = 'text/asciidoc'
    const page = publishable ? { contents, mediaType, out: {} } : { contents, mediaType }
    contentCatalog.pages.push(page)
    return page
  }

  const addPartial = (contents, mediaType = 'text/asciidoc') => {
    contents = Buffer.from(contents)
    const partial = { contents, mediaType, src: { family: 'partial' } }
    contentCatalog.partials.push(partial)
    return partial
  }

  const createContentCatalog = () => ({
    pages: [],
    partials: [],
    getPages (filter) {
      return filter ? this.pages.filter(filter) : this.pages.slice()
    },
    findBy () {
      return this.partials
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

  const run = (config) => {
    ext.register.call(generatorContext, config ? { config } : {})
    generatorContext.updateVariables({ playbook, contentCatalog })
    return generatorContext.contentClassified(generatorContext.variables)
  }

  let generatorContext
  let playbook
  let contentCatalog

  beforeEach(() => {
    generatorContext = createGeneratorContext()
    playbook = { asciidoc: { extensions: ['@asciidoctor/tabs'] } }
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

  describe('migrate tabs syntax', () => {
    it('should return undefined from contentClassified listener if no pages to process', () => {
      contentCatalog.getPages = spy(contentCatalog.getPages)
      expect(run()).to.be.undefined()
      expect(contentCatalog.getPages).to.have.been.called()
    })

    it('should only operate on publishable pages regardless of unwrap_example_block setting', () => {
      ;['always', 'never', 'tabs'].forEach((unwrapExampleBlock) => {
        const input = '= Page Title\n\nno tabs here'
        const page = addPage(input, false)
        const pageContentsBuffer = page.contents
        spy.on(pageContentsBuffer, ['indexOf', 'toString'])
        contentCatalog.getPages = spy(contentCatalog.getPages)
        expect(run()).to.be.undefined()
        expect(contentCatalog.getPages).to.have.been.called()
        expect(pageContentsBuffer.indexOf).to.not.have.been.called()
        expect(pageContentsBuffer.toString).to.not.have.been.called()
        expect(contentCatalog.pages[0].contents).to.equal(pageContentsBuffer)
        contentCatalog.pages.splice(0)
      })
    })

    it('should only operate on text/asciidoc partials regardless of unwrap_example_block setting', () => {
      ;['always', 'never', 'tabs'].forEach((unwrapExampleBlock) => {
        const input = 'no tabs here'
        const partial = addPartial(input, 'text/plain')
        const partialContentsBuffer = partial.contents
        spy.on(partialContentsBuffer, ['indexOf', 'toString'])
        contentCatalog.findBy = spy(contentCatalog.findBy)
        expect(run()).to.be.undefined()
        expect(contentCatalog.findBy).to.have.been.called()
        expect(partialContentsBuffer.indexOf).to.not.have.been.called()
        expect(partialContentsBuffer.toString).to.not.have.been.called()
        expect(contentCatalog.partials[0].contents).to.equal(partialContentsBuffer)
        contentCatalog.partials.splice(0)
      })
    })

    it('should only operate on publishable pages that have role="primary" when unwrap_example_block is never', () => {
      const inputWithoutSig = heredoc`
      = Page Title

      ====
      plain example block
      ====
      `

      const inputWithSig = heredoc`
      = Page Title

      .tab title
      [role="primary"]
      tab contents
      `

      const pageWithoutSig = addPage(inputWithoutSig)
      const pageWithoutSigContents = pageWithoutSig.contents
      spy.on(pageWithoutSigContents, ['indexOf', 'toString'])
      const pageWithSig = addPage(inputWithSig)
      const pageWithSigContents = pageWithSig.contents
      spy.on(pageWithSigContents, ['indexOf', 'toString'])
      expect(run({ unwrapExampleBlock: 'never' })).to.be.undefined()
      expect(pageWithoutSigContents.indexOf).to.have.been.called()
      expect(pageWithoutSigContents.toString).to.not.have.been.called()
      expect(contentCatalog.pages[0].contents).to.equal(pageWithoutSigContents)
      expect(pageWithSigContents.indexOf).to.have.been.called()
      expect(pageWithSigContents.toString).to.have.been.called()
      expect(contentCatalog.pages[1].contents).to.not.equal(pageWithSigContents)
    })

    it('should only operate on publishable pages that have role="primary" when unwrap_example_block is tabs', () => {
      const inputWithoutSig = heredoc`
      = Page Title

      ====
      .title
      ----
      listing in example block
      ----
      ====
      `

      const inputWithSig = heredoc`
      = Page Title

      ====
      .tab title
      [role="primary"]
      tab contents
      ====
      `

      const pageWithoutSig = addPage(inputWithoutSig)
      const pageWithoutSigContents = pageWithoutSig.contents
      spy.on(pageWithoutSigContents, ['indexOf', 'toString'])
      const pageWithSig = addPage(inputWithSig)
      const pageWithSigContents = pageWithSig.contents
      spy.on(pageWithSigContents, ['indexOf', 'toString'])
      expect(run({ unwrapExampleBlock: 'tabs' })).to.be.undefined()
      expect(pageWithoutSigContents.indexOf).to.have.been.called()
      expect(pageWithoutSigContents.toString).to.not.have.been.called()
      expect(contentCatalog.pages[0].contents).to.equal(pageWithoutSigContents)
      expect(pageWithSigContents.indexOf).to.have.been.called()
      expect(pageWithSigContents.toString).to.have.been.called()
      expect(contentCatalog.pages[1].contents).to.not.equal(pageWithSigContents)
    })

    it('should only operate on publishable pages that have role="primary" or ==== when unwrap_example_block is always', () => {
      const inputWithExSig = heredoc`
      = Page Title

      [NOTE]
      ====
      admonition block
      ====
      `

      const inputWithTabSig = heredoc`
      = Page Title

      .tab title
      [role="primary"]
      tab contents
      `

      const pageWithExSig = addPage(inputWithExSig)
      const pageWithExSigContents = pageWithExSig.contents
      spy.on(pageWithExSigContents, ['indexOf', 'toString'])
      const pageWithTabSig = addPage(inputWithTabSig)
      const pageWithTabSigContents = pageWithTabSig.contents
      spy.on(pageWithTabSigContents, ['indexOf', 'toString'])
      expect(run({ unwrapExampleBlock: 'always' })).to.be.undefined()
      expect(pageWithExSigContents.indexOf).to.have.been.called()
      expect(pageWithExSigContents.toString).to.have.been.called()
      expect(contentCatalog.pages[0].contents).to.equal(pageWithExSigContents)
      expect(pageWithTabSigContents.indexOf).to.have.been.called()
      expect(pageWithTabSigContents.toString).to.have.been.called()
      expect(contentCatalog.pages[1].contents).to.not.equal(pageWithTabSigContents)
    })

    it('should migrate old tabs without enclosure in page to new tabs', () => {
      const input = heredoc`
      = Page Title

      ${SAMPLE_OLD_TABS}
      `

      const expected = heredoc`
      = Page Title

      ${SAMPLE_NEW_TABS}
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should migrate old tabs without enclosure in partial to new tabs', () => {
      const input = SAMPLE_OLD_TABS
      const expected = SAMPLE_NEW_TABS
      addPartial(input)
      run()
      const actual = contentCatalog.findBy({ family: 'partial' })[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should allow tabs delimiter length for tabs block to be customized', () => {
      const input = heredoc`
      = Page Title

      ${SAMPLE_OLD_TABS}
      `

      const sampleNewTabs = SAMPLE_NEW_TABS.split('\n')
        .map((l) => (l === '======' ? '====' : l))
        .join('\n')

      const expected = heredoc`
      = Page Title

      ${sampleNewTabs}
      `

      addPage(input)
      run({ tabsDelimiterLength: 4 })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should migrate old tabs enclosed in example block to tabs block and unwrap when unwrap_example_block is tabs', () => {
      const input = heredoc`
      = Page Title

      ====
      ${SAMPLE_OLD_TABS}
      ====
      `

      const expected = heredoc`
      = Page Title

      ${SAMPLE_NEW_TABS}
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should migrate old tabs enclosed in example block to tabs block when no space between sibling blocks', () => {
      const input = heredoc`
      = Page Title

      ====
      ${filterLines(SAMPLE_OLD_TABS, (l) => l)}
      ====
      `

      const expected = heredoc`
      = Page Title

      ${SAMPLE_NEW_TABS}
      `

      addPage(input)
      run({ unwrapExampleBlock: 'tabs' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should migrate tabs wrapped in example block to tabs block when unwrap_example_block is never', () => {
      const input = heredoc`
      = Page Title

      ====
      ${SAMPLE_OLD_TABS}
      ====
      `

      const expected = heredoc`
      = Page Title

      ====
      ${SAMPLE_NEW_TABS}
      ====
      `

      addPage(input)
      run({ unwrapExampleBlock: 'never' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should migrate tabs with inverted syntax to tabs block', () => {
      const input = heredoc`
      = Page Title

      ${SAMPLE_OLD_TABS_INVERTED}
      `

      const expected = heredoc`
      = Page Title

      ${SAMPLE_NEW_TABS}
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should preserve trailing space when migrating tabs', () => {
      const input = heredoc`
      = Page Title

      ${SAMPLE_OLD_TABS}
         \\
      `

      const expected = heredoc`
      = Page Title

      ${SAMPLE_NEW_TABS}
         \\
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should migrate tabs not at end of file to tabs block', () => {
      const input = heredoc`
      = Page Title

      ${SAMPLE_OLD_TABS}

      final paragraph
      `

      const expected = heredoc`
      = Page Title

      ${SAMPLE_NEW_TABS}

      final paragraph
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should migrate multiple example blocks with tabs to tabs blocks', () => {
      const input = heredoc`
      = Page Title

      ====
      ${SAMPLE_OLD_TABS}
      ====

      and also

      ${SAMPLE_OLD_TABS}
      `

      const expected = heredoc`
      = Page Title

      ${SAMPLE_NEW_TABS}

      and also

      ${SAMPLE_NEW_TABS}
      `

      addPage(input)
      run({ unwrapExampleBlock: 'tabs' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should migrate multiple paragraph tabs to tabs blocks', () => {
      const input = heredoc`
      = Page Title

      Let's make some tabs.

      .First Tab
      [role="primary"]
      Contents of first tab.

      .Second Tab
      [role="secondary"]
      Contents of second tab.
      This one has two lines.

      .Third Tab
      [role="secondary"]
       Contents of third tab.

      There you have it.
      `

      const expected = heredoc`
      = Page Title

      Let's make some tabs.

      [tabs]
      ======
      First Tab::
      +
      [role="primary"]
      Contents of first tab.

      Second Tab::
      +
      [role="secondary"]
      Contents of second tab.
      This one has two lines.

      Third Tab::
      +
      [role="secondary"]
       Contents of third tab.
      ======

      There you have it.
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should start new tabs block when adjacent role="primary" is encountered below block title', () => {
      const input = heredoc`
      = Page Title

      .First Tab
      [role="primary"]
      Contents of first tab.

      .Second Tab
      [role="secondary"]
      Contents of second tab.

      .First Tab
      [role="primary"]
      Contents of first tab.

      .Second Tab
      [role="secondary"]
      Contents of second tab.
      `

      const expected = heredoc`
      = Page Title

      [tabs]
      ======
      First Tab::
      +
      [role="primary"]
      Contents of first tab.

      Second Tab::
      +
      [role="secondary"]
      Contents of second tab.
      ======

      [tabs]
      ======
      First Tab::
      +
      [role="primary"]
      Contents of first tab.

      Second Tab::
      +
      [role="secondary"]
      Contents of second tab.
      ======
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should start new tabs block when adjacent role="primary" is encountered above block title', () => {
      const input = heredoc`
      = Page Title

      [role="primary"]
      .First Tab
      Contents of first tab.

      [role="secondary"]
      .Second Tab
      Contents of second tab.

      [role="primary"]
      .First Tab
      Contents of first tab.

      [role="secondary"]
      .Second Tab
      Contents of second tab.
      `

      const expected = heredoc`
      = Page Title

      [tabs]
      ======
      First Tab::
      +
      [role="primary"]
      Contents of first tab.

      Second Tab::
      +
      [role="secondary"]
      Contents of second tab.
      ======

      [tabs]
      ======
      First Tab::
      +
      [role="primary"]
      Contents of first tab.

      Second Tab::
      +
      [role="secondary"]
      Contents of second tab.
      ======
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should migrate block metadata on example block with tabs to tabs block', () => {
      for (const blockMetadataLine of ['[#tabs-1]', '[[tabs-1]]', '.Tabs']) {
        const input = heredoc`
        = Page Title

        ${blockMetadataLine}
        ====
        ${SAMPLE_OLD_TABS}
        ====
        `

        const expected = heredoc`
        = Page Title

        ${blockMetadataLine}
        ${SAMPLE_NEW_TABS}
        `

        contentCatalog.pages.splice(0)
        addPage(input)
        run({ unwrapExampleBlock: 'tabs' })
        const actual = contentCatalog.getPages()[0].contents.toString()
        expect(actual).to.equal(expected)
      }
    })

    it('should migrate example block with tabs and block title to tabs block when unwrap_example_block is tabs', () => {
      const input = heredoc`
      = Page Title

      .Tabs
      ====
      ${SAMPLE_OLD_TABS}
      ====
      `

      const expected = heredoc`
      = Page Title

      .Tabs
      ${SAMPLE_NEW_TABS}
      `

      addPage(input)
      run({ unwrapExampleBlock: 'tabs' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not unwrap single example block if it starts at top of file', () => {
      const input = heredoc`
      ====
      .title
      ----
      verbatim content
      ----
      ====
      `

      const expected = input
      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not migrate tabs if @asciidoctor/tabs extension is not registered', () => {
      const input = heredoc`
      = Page Title

      ${SAMPLE_OLD_TABS}
      `

      playbook.asciidoc.extensions.splice(0)
      addPage(input)
      run()
      expect(contentCatalog.getPages()[0].contents.toString()).to.equal(input)
    })

    it('should unwrap example block with single paragraph when unwrap_example_block is always', () => {
      const input = heredoc`
      = Page Title

      ====
      example block
      ====
      `

      const expected = heredoc`
      = Page Title

      example block
      `

      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should unwrap example block with single source block when unwrap_example_block is always', () => {
      const input = heredoc`
      = Page Title

      ====
      [,xml]
      ----
      <?xml version="1.0" encoding="UTF-8"?>
      <beans xmlns="http://www.springframework.org/schema/beans"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:int="http://www.springframework.org/schema/integration"
        xsi:schemaLocation="
          http://www.springframework.org/schema/beans
          https://www.springframework.org/schema/beans/spring-beans.xsd
          http://www.springframework.org/schema/integration
          https://www.springframework.org/schema/integration/spring-integration.xsd">
          ...
      </beans>
      ----
      ====
      `

      const expected = heredoc`
      = Page Title

      [,xml]
      ----
      <?xml version="1.0" encoding="UTF-8"?>
      <beans xmlns="http://www.springframework.org/schema/beans"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:int="http://www.springframework.org/schema/integration"
        xsi:schemaLocation="
          http://www.springframework.org/schema/beans
          https://www.springframework.org/schema/beans/spring-beans.xsd
          http://www.springframework.org/schema/integration
          https://www.springframework.org/schema/integration/spring-integration.xsd">
          ...
      </beans>
      ----
      `

      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not unwrap example block without tabs when unwrap_example_block is tabs', () => {
      const input = heredoc`
      = Page Title

      ====
      .What's a computer say?
      [,ruby]
      ----
      puts 'Hello!'
      ----

      No tabs here.
      ====
      `

      const expected = input
      addPage(input)
      run({ unwrapExampleBlock: 'tabs' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not unwrap example block with title and non-tab code blocks when unwrap_example_block is always', () => {
      const input = heredoc`
      = Page Title

      .Unauthenticated User Requests Protected Resource
      ====
      [source,http]
      ----
      GET / HTTP/1.1
      Host: example.com
      Cookie: SESSION=91470ce0-3f3c-455b-b7ad-079b02290f7b
      ----

      [source,http]
      ----
      HTTP/1.1 302 Found
      Location: /login
      ----
      ====
      `

      const expected = input
      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not unwrap example block with title and mixed non-tab blocks when unwrap_example_block is always', () => {
      const input = heredoc`
      = Page Title

      .What's a computer say?
      ====
      [,ruby]
      ----
      puts 'Hello!'
      ----

      No tabs here.
      ====
      `

      const expected = input
      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should merge title on example block with title of only non-tab child when unwrap_example_block is always', () => {
      const input = heredoc`
      = Page Title

      .Login Form
      ====
      .src/main/webapp/login.html
      [,xml]
      ----
      <form th:action="@{/login}" method="post">
      </form>
      ----
      ====
      `

      const expected = heredoc`
      = Page Title

      .Login Form - src/main/webapp/login.html
      [,xml]
      ----
      <form th:action="@{/login}" method="post">
      </form>
      ----
      `

      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should transfer ID and merge title on example block with title of only non-tab child when unwrap_example_block is always', () => {
      const input = heredoc`
      = Page Title

      [#login-form]
      .Login Form
      ====
      .src/main/webapp/login.html
      [,xml]
      ----
      <form th:action="@{/login}" method="post">
      </form>
      ----
      ====
      `

      const expected = heredoc`
      = Page Title

      [#login-form]
      .Login Form - src/main/webapp/login.html
      [,xml]
      ----
      <form th:action="@{/login}" method="post">
      </form>
      ----
      `

      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should discover title to merge on child block below ID when unwrap_example_block is always', () => {
      const input = heredoc`
      = Page Title

      .Login Form
      ====
      [,xml]
      .src/main/webapp/login.html
      ----
      <form th:action="@{/login}" method="post">
      </form>
      ----
      ====
      `

      const expected = heredoc`
      = Page Title

      [,xml]
      .Login Form - src/main/webapp/login.html
      ----
      <form th:action="@{/login}" method="post">
      </form>
      ----
      `

      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should transfer title from example block to child block when child block has no title and unwrap_example_block is always', () => {
      const input = heredoc`
      = Page Title

      .Login Form
      ====
      [,xml]
      ----
      <form th:action="@{/login}" method="post">
      </form>
      ----
      ====
      `

      const expected = heredoc`
      = Page Title

      .Login Form
      [,xml]
      ----
      <form th:action="@{/login}" method="post">
      </form>
      ----
      `

      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not look for old tabs inside verbatim block', () => {
      const input = heredoc`
      = Page Title

      ----
      ====
      .Tab
      [role="primary"]
      This is the contents of the tab.
      ====
      ----

      ....
      ====
      .Tab
      [role="primary"]
      This is the contents of the second tab.
      ====
      ....
      `

      const expected = input
      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not close tabs prematurely when verbatim block ends with empty line', () => {
      const input = heredoc`
      = Page Title

      .Tab A
      [role="primary"]
      ----
      listing with empty last line

      ----
      .Tab B
      [role="secondary"]
      This is the contents of the second tab.
      `

      const expected = heredoc`
      = Page Title

      [tabs]
      ======
      Tab A::
      +
      [role="primary"]
      ----
      listing with empty last line

      ----

      Tab B::
      +
      [role="secondary"]
      This is the contents of the second tab.
      ======
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should preserve admonition block around tabs when unwrap_example_block is tabs', () => {
      const input = heredoc`
      = Page Title

      [NOTE]
      ====
      ${SAMPLE_OLD_TABS}
      ====
      `

      const expected = heredoc`
      = Page Title

      [NOTE]
      ====
      ${SAMPLE_NEW_TABS}
      ====
      `

      addPage(input)
      run({ unwrapExampleBlock: 'tabs' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should preserve admonition block with title around tabs when unwrap_example_block is tabs', () => {
      const input = heredoc`
      = Page Title

      [NOTE]
      .These are tabs
      ====
      ${SAMPLE_OLD_TABS}
      ====
      `

      const expected = heredoc`
      = Page Title

      [NOTE]
      .These are tabs
      ====
      ${SAMPLE_NEW_TABS}
      ====
      `

      addPage(input)
      run({ unwrapExampleBlock: 'tabs' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should leave lines unprocessed (and not fail) if old tabs block in example block ends prematurely', () => {
      const input = heredoc`
      = Page Title

      ====
      [role="primary"]
      `

      addPage(input)
      run({ unwrapExampleBlock: 'never' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(input)
    })

    // FIXME this should probably leave the lines as is
    it('should remove lines if old tabs block in example block ends prematurely and unwrap_example_block is tabs', () => {
      const input = heredoc`
      = Page Title

      ====
      [role="primary"]
      `

      const expected = heredoc`
      = Page Title

      [role="primary"]
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should detect and remove unterminated example block', () => {
      const input = heredoc`
      = Page Title

      == First Section

      ====
      ${SAMPLE_OLD_TABS}
      ====

      ====

      [[next-section]]
      == Next Section

      content
      `

      const expected = heredoc`
      = Page Title

      == First Section

      ${SAMPLE_NEW_TABS}

      //====

      [[next-section]]
      == Next Section

      content
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should close tabs wrapped in unterminated example block', () => {
      const input = heredoc`
      = Page Title

      == First Section

      ====
      ${SAMPLE_OLD_TABS}

      [[next-section]]
      == Next Section

      content
      `

      const expected = heredoc`
      = Page Title

      == First Section

      ${SAMPLE_NEW_TABS}

      [[next-section]]
      == Next Section

      content
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not attempt to comment out unterminated example block when unwrap_example_block is always', () => {
      const input = heredoc`
      Yada yada.

      ====
      [source,xml]
      ----
      <http ...>
        <csrf request-matcher-ref="csrfMatcher"/>
      </http>
      ----

      [[legacy-config]]
      == Legacy config
      `

      const expected = heredoc`
      Yada yada.

      [source,xml]
      ----
      <http ...>
        <csrf request-matcher-ref="csrfMatcher"/>
      </http>
      ----

      [[legacy-config]]
      == Legacy config
      `

      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should process listing blocks with delimiter length of 5', () => {
      const sampleOldTabs = SAMPLE_OLD_TABS.split('\n')
        .map((l) => (l === '----' ? l + '-' : l))
        .join('\n')
      const sampleNewTabs = SAMPLE_NEW_TABS.split('\n')
        .map((l) => (l === '----' ? l + '-' : l))
        .join('\n')

      const input = heredoc`
      = Page Title

      ====
      ${sampleOldTabs}
      ====
      `

      const expected = heredoc`
      = Page Title

      ${sampleNewTabs}
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not drop floating block anchor', () => {
      const input = heredoc`
      = Page Title

      ${SAMPLE_OLD_TABS}

      [[name-of-fragment]]

      This paragraph has the ID name-of-fragment.

      [[another-fragment]]

      This paragraph has the ID another-fragment.
      `

      const expected = heredoc`
      = Page Title

      ${SAMPLE_NEW_TABS}


      [[name-of-fragment]]
      This paragraph has the ID name-of-fragment.


      [[another-fragment]]
      This paragraph has the ID another-fragment.
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should normalize empty lines if normalize is set', () => {
      const input = heredoc`
      = Page Title

      == Section Title


      [#sample-tabs]
      ====
      ${SAMPLE_OLD_TABS}
      ====

      [[name-of-fragment]]
      This paragraph has the ID name-of-fragment.

      [[another-fragment]]

      This paragraph has the ID another-fragment.
      `

      const expected = heredoc`
      = Page Title

      == Section Title

      [#sample-tabs]
      ${SAMPLE_NEW_TABS}

      [[name-of-fragment]]
      This paragraph has the ID name-of-fragment.

      [[another-fragment]]
      This paragraph has the ID another-fragment.
      `

      addPage(input)
      run({ normalize: true })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not treat line that begins with ellipsis as block title', () => {
      const input = heredoc`
      As in the following exapmle:

      [,yaml]
      ----
      key: val
      ----

      ...and the figglebizz may be configured as follows:

      ====
      ${SAMPLE_OLD_TABS}
      ====
      `

      const expected = heredoc`
      As in the following exapmle:

      [,yaml]
      ----
      key: val
      ----

      ...and the figglebizz may be configured as follows:

      ${SAMPLE_NEW_TABS}
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should not drop block anchor on admonition', () => {
      const input = heredoc`
      = Page Title

      ${SAMPLE_OLD_TABS}

      == Section Title

      [[pro-tip]]
      [NOTE]
      ====
      This is a pro tip.
      ====
      `

      const expected = heredoc`
      = Page Title

      ${SAMPLE_NEW_TABS}

      == Section Title

      [[pro-tip]]
      [NOTE]
      ====
      This is a pro tip.
      ====
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should automatically shorted delimiter length of tabs inside example block inside admonition block', () => {
      const input = heredoc`
      = Page Title

      before

      [NOTE]
      ======
      This admonition block contains a tabs block.

      ====
      ${SAMPLE_OLD_TABS}
      ====
      ======

      after
      `

      const sampleNewTabs = SAMPLE_NEW_TABS.split('\n')
        .map((l) => (l === '======' ? '====' : l))
        .join('\n')

      const expected = heredoc`
      = Page Title

      before

      [NOTE]
      ======
      This admonition block contains a tabs block.

      ${sampleNewTabs}
      ======

      after
      `

      addPage(input)
      run()
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should automatically lengthen delimiter length of tabs inside example block inside admonition block', () => {
      const input = heredoc`
      = Page Title

      before

      [NOTE]
      ====
      This admonition block contains a tabs block.

      ======
      ${SAMPLE_OLD_TABS}
      ======
      ====

      after
      `

      const expected = heredoc`
      = Page Title

      before

      [NOTE]
      ====
      This admonition block contains a tabs block.

      ${SAMPLE_NEW_TABS}
      ====

      after
      `

      addPage(input)
      run({ tabsDelimiterLength: 4 })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should close tabs block before directly adjacent non-tabs block', () => {
      const input = heredoc`
      = Page Title

      .Non-tab directly following tab
      ====
      .Java
      [source,java,role="primary"]
      ----
      System.out.println("hi");
      ----
      .XML
      [source,xml]
      ----
      <project>
        <name>fizzbuzz</name>
      </project>
      ----
      ====
      `

      const expected = heredoc`
      = Page Title

      .Non-tab directly following tab
      ====
      [tabs]
      ======
      Java::
      +
      [source,java,role="primary"]
      ----
      System.out.println("hi");
      ----
      ======
      .XML
      [source,xml]
      ----
      <project>
        <name>fizzbuzz</name>
      </project>
      ----
      ====
      `

      addPage(input)
      run({ unwrapExampleBlock: 'never' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should close tabs block before directly adjacent non-tabs paragraph', () => {
      const input = heredoc`
      = Page Title

      .Non-tab directly following tab
      ====
      .Tab
      [source,java,role="primary"]
      This is a tab paragraph.
      It has multiple lines.
      [[p1]]
      This is not a tab paragraph.
      It also has multiple lines.
      ====
      `

      const expected = heredoc`
      = Page Title

      .Non-tab directly following tab
      ====
      [tabs]
      ======
      Tab::
      +
      [source,java,role="primary"]
      This is a tab paragraph.
      It has multiple lines.
      ======
      [[p1]]
      This is not a tab paragraph.
      It also has multiple lines.
      ====
      `

      addPage(input)
      run({ unwrapExampleBlock: 'never' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })

    it('should unwrap example in example', () => {
      const input = heredoc`
      = Page Title

      ====
      outer example block

      ======
      inner example block
      ======
      ====
      `

      const expected = heredoc`
      = Page Title

      outer example block

      inner example block
      `

      addPage(input)
      run({ unwrapExampleBlock: 'always' })
      const actual = contentCatalog.getPages()[0].contents.toString()
      expect(actual).to.equal(expected)
    })
  })

  describe('save result', () => {
    beforeEach(() => cleanDir(WORK_DIR, { create: true }))

    after(() => cleanDir(WORK_DIR))

    it('should return undefined from contentClassified listener if save_result is set and no pages to process', () => {
      expect(run({ saveResult: true })).to.be.undefined()
    })

    it('should save result to local source file if contents were changed and save_result option is set', async () => {
      const inputWithOldTabs = heredoc`
      = With Old Tabs

      ====
      ${SAMPLE_OLD_TABS}
      ====
      `

      const expectedWithOldTabs = heredoc`
      = With Old Tabs

      ${SAMPLE_NEW_TABS}
      `

      const inputWithNewTabs = heredoc`
      = With New Tabs

      ${SAMPLE_NEW_TABS}
      `

      const abspathWithOldTabs = ospath.join(WORK_DIR, 'sample-with-old-tabs.adoc')
      const abspathWithNewTabs = ospath.join(WORK_DIR, 'sample-with-new-tabs.adoc')
      contentCatalog.pages.push({
        contents: Buffer.from(inputWithOldTabs + '\n'),
        mediaType: 'text/asciidoc',
        src: { abspath: abspathWithOldTabs },
        out: {},
      })
      contentCatalog.pages.push({
        contents: Buffer.from(inputWithNewTabs + '\n'),
        mediaType: 'text/asciidoc',
        src: { abspath: abspathWithNewTabs },
        out: {},
      })
      const returnVal = run({ saveResult: true, unwrapExampleBlock: 'tabs' })
      expect(returnVal).to.be.instanceOf(Promise)
      await returnVal
      expect(abspathWithOldTabs)
        .to.be.a.file()
        .with.contents(expectedWithOldTabs + '\n')
      expect(abspathWithNewTabs).to.not.be.a.path()
    })
  })
})
