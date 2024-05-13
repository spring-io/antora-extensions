/* eslint-env mocha */
'use strict'

const { captureLogSync, expect, heredoc, mockContentCatalog } = require('./harness')

const { name: packageName } = require('#package')
const buildNavigation = require(packageName + '/build-navigation')
const { resolveAsciiDocConfig } = require('@antora/asciidoc-loader')

describe('buildNavigation()', () => {
  it('should run on all files in the navigation family', () => {
    const contentCatalog = mockContentCatalog().spyOn('findBy')
    buildNavigation(contentCatalog)
    expect(contentCatalog.findBy).nth(1).called.with({ family: 'nav' })
  })

  it('should build single navigation list with title', () => {
    const navContents = heredoc`
      .xref:index.adoc[Module A]
      * xref:requirements.adoc[Requirements]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
      { family: 'page', relative: 'requirements.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Module A',
      url: '/component-a/module-a/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'Requirements',
          url: '/component-a/module-a/requirements.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should build single navigation list without title', () => {
    const navContents = heredoc`
      * xref:index.adoc[Module A]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Module A',
          url: '/component-a/module-a/index.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should be able to reference page with same root-relative path as nav file', () => {
    const navContents = heredoc`
      * xref:home.adoc[Home]
      * xref:nav.adoc[About Nav]
      * xref:nav$nav.adoc[Page Top]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'home.adoc' },
      { family: 'page', relative: 'nav.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Home',
          url: '/component-a/module-a/home.html',
          urlType: 'internal',
        },
        {
          content: 'About Nav',
          url: '/component-a/module-a/nav.html',
          urlType: 'internal',
        },
        {
          content: 'Page Top',
          hash: '#',
          url: '#',
          urlType: 'fragment',
        },
      ],
    })
  })

  it('should build navigation across multiple components', () => {
    const navContentsA = heredoc`
      .xref:index.adoc[Component A]
      * xref:the-page.adoc[The Page]
    `
    const navContentsB = heredoc`
      .xref:index.adoc[Component B]
      * xref:the-page.adoc[The Page]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContentsA,
        navIndex: 0,
      },
      {
        component: 'component-b',
        module: 'ROOT',
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContentsB,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
      { family: 'page', relative: 'the-page.adoc' },
      { component: 'component-b', module: 'ROOT', family: 'page', relative: 'index.adoc' },
      { component: 'component-b', module: 'ROOT', family: 'page', relative: 'the-page.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menuA = navCatalog.getNavigation('component-a', '')
    expect(menuA).to.exist()
    expect(menuA).to.have.lengthOf(1)
    expect(menuA[0]).to.eql({
      order: 0,
      root: true,
      content: 'Component A',
      url: '/component-a/module-a/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'The Page',
          url: '/component-a/module-a/the-page.html',
          urlType: 'internal',
        },
      ],
    })
    const menuB = navCatalog.getNavigation('component-b', '')
    expect(menuB).to.exist()
    expect(menuB).to.have.lengthOf(1)
    expect(menuB[0]).to.eql({
      order: 0,
      root: true,
      content: 'Component B',
      url: '/component-b/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'The Page',
          url: '/component-b/the-page.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should assign navigation to component version in content catalog', () => {
    const navContentsA = heredoc`
      .xref:index.adoc[Component A]
      * xref:the-page.adoc[The Page]
    `
    const navContentsB = heredoc`
      .xref:index.adoc[Component B]
      * xref:the-page.adoc[The Page]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContentsA,
        navIndex: 0,
      },
      {
        component: 'component-b',
        module: 'ROOT',
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContentsB,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
      { family: 'page', relative: 'the-page.adoc' },
      { component: 'component-b', module: 'ROOT', family: 'page', relative: 'index.adoc' },
      { component: 'component-b', module: 'ROOT', family: 'page', relative: 'the-page.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    expect(contentCatalog.getComponentVersion('component-a', '').navigation).to.equal(
      navCatalog.getNavigation('component-a', '')
    )
    expect(contentCatalog.getComponentVersion('component-b', '').navigation).to.equal(
      navCatalog.getNavigation('component-b', '')
    )
  })

  it('should resolve page references relative to module of navigation file', () => {
    const navContents = heredoc`
      * xref:page-a.adoc[This Module]
      * xref:module-b:page-b.adoc[Other Module]
      * xref:0.9@page-c.adoc#detail[Older Version]
      * xref:component-b::page-d.adoc[Other Component]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'page-a.adoc' },
      { module: 'module-b', family: 'page', relative: 'page-b.adoc' },
      { version: '0.9', family: 'page', relative: 'page-c.adoc' },
      { component: 'component-b', version: '1.1', module: 'ROOT', family: 'page', relative: 'page-d.adoc' },
    ]).spyOn('getById', 'getComponent')
    buildNavigation(contentCatalog)
    expect(contentCatalog.getById).nth(1).called.with({
      component: 'component-a',
      version: '',
      module: 'module-a',
      family: 'page',
      relative: 'page-a.adoc',
    })
    expect(contentCatalog.getById).nth(2).called.with({
      component: 'component-a',
      version: '',
      module: 'module-b',
      family: 'page',
      relative: 'page-b.adoc',
    })
    expect(contentCatalog.getById).nth(3).called.with({
      component: 'component-a',
      version: '0.9',
      module: 'module-a',
      family: 'page',
      relative: 'page-c.adoc',
    })
    expect(contentCatalog.getComponent).nth(1).called.with('component-a')
    expect(contentCatalog.getComponent).nth(2).called.with('component-b')
    expect(contentCatalog.getById).nth(4).called.with({
      component: 'component-b',
      version: '1.1',
      module: 'ROOT',
      family: 'page',
      relative: 'page-d.adoc',
    })
  })

  it('should mark entry with unresolved page reference as unresolved internal url', () => {
    const navContents = heredoc`
      * xref:page-to-nowhere.adoc[Destination Unknown]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
    ])
    const { messages, returnValue: navCatalog } = captureLogSync(() =>
      buildNavigation(contentCatalog, resolveAsciiDocConfig())
    ).withReturnValue()
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Destination Unknown',
          roles: 'unresolved',
          url: '#page-to-nowhere.adoc',
          urlType: 'internal',
          unresolved: true,
        },
      ],
    })
    expect(messages).to.have.lengthOf(1)
    expect(messages[0]).to.eql({
      level: 'error',
      name: 'asciidoctor',
      msg: 'target of xref not found: page-to-nowhere.adoc',
      file: { path: 'modules/module-a/nav.adoc' },
    })
  })

  it('should use navtitle of target page if content not given and target page has navtitle', () => {
    const navContents = heredoc`
      * xref:the-page.adoc[]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      {
        relative: 'the-page.adoc',
      },
    ])
    const targetPage = contentCatalog.getFiles()[1]
    targetPage.asciidoc = { doctitle: 'The Page Title', xreftext: 'reference me', navtitle: 'Page Title' }
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Page Title',
          url: '/component-a/module-a/the-page.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should use spec of target page if content not given and target page has no navtitle', () => {
    const navContents = heredoc`
      * xref:the-page.adoc[]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      {
        relative: 'the-page.adoc',
      },
    ])
    const targetPage = contentCatalog.getFiles()[1]
    targetPage.asciidoc = { doctitle: 'The Page Title', xreftext: 'reference me' }
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'the-page.adoc',
          url: '/component-a/module-a/the-page.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should use page ID spec of target page if content not given and target page has no navtitle or xreftext', () => {
    const navContents = heredoc`
      * xref:the-page.adoc[]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      {
        relative: 'the-page.adoc',
      },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'the-page.adoc',
          url: '/component-a/module-a/the-page.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should use page ID spec of target page if content not given and page ID spec has fragment', () => {
    const navContents = heredoc`
      * xref:the-page.adoc#anchor[]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      {
        relative: 'the-page.adoc',
      },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'the-page.adoc#anchor',
          hash: '#anchor',
          url: '/component-a/module-a/the-page.html#anchor',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should store url for page reference as root relative path with urlType set to internal', () => {
    const navContents = heredoc`
      * xref:page-a.adoc[This Module]
      * xref:module-b:page-b.adoc[Other Module]
      * xref:0.9@page-c.adoc#detail[Older Version]
      * xref:component-b::page-d.adoc[Other Component]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'page-a.adoc' },
      { module: 'module-b', family: 'page', relative: 'page-b.adoc' },
      { version: '0.9', family: 'page', relative: 'page-c.adoc' },
      { component: 'component-b', version: '', module: 'ROOT', family: 'page', relative: 'page-d.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'This Module',
          url: '/component-a/module-a/page-a.html',
          urlType: 'internal',
        },
        {
          content: 'Other Module',
          url: '/component-a/module-b/page-b.html',
          urlType: 'internal',
        },
        {
          content: 'Older Version',
          hash: '#detail',
          url: '/component-a/0.9/module-a/page-c.html#detail',
          urlType: 'internal',
        },
        {
          content: 'Other Component',
          url: '/component-b/page-d.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should store url for page reference as root relative path with urlType set to internal when version is master', () => {
    const navContents = heredoc`
      * xref:page-a.adoc[Page A]
      * xref:component-b::page-b.adoc[Page B]
    `
    const contentCatalog = mockContentCatalog([
      {
        version: 'master',
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', version: 'master', relative: 'page-a.adoc' },
      { component: 'component-b', version: 'master', module: 'ROOT', family: 'page', relative: 'page-b.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', 'master')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Page A',
          url: '/component-a/module-a/page-a.html',
          urlType: 'internal',
        },
        {
          content: 'Page B',
          url: '/component-b/page-b.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should allow navigation file to be outside of module', () => {
    const navContents = heredoc`
      * xref:ROOT:index.adoc[Basics]
       ** xref:basics:requirements.adoc[Requirements]
      * xref:advanced:index.adoc[Advanced]
       ** xref:advanced:caching.adoc[Caching]
    `
    const contentCatalog = mockContentCatalog([
      {
        module: '',
        family: 'nav',
        relative: 'modules/nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { module: 'ROOT', family: 'page', relative: 'index.adoc' },
      { module: 'basics', family: 'page', relative: 'requirements.adoc' },
      { module: 'advanced', family: 'page', relative: 'index.adoc' },
      { module: 'advanced', family: 'page', relative: 'caching.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Basics',
          url: '/component-a/index.html',
          urlType: 'internal',
          items: [
            {
              content: 'Requirements',
              url: '/component-a/basics/requirements.html',
              urlType: 'internal',
            },
          ],
        },
        {
          content: 'Advanced',
          url: '/component-a/advanced/index.html',
          urlType: 'internal',
          items: [
            {
              content: 'Caching',
              url: '/component-a/advanced/caching.html',
              urlType: 'internal',
            },
          ],
        },
      ],
    })
  })

  it('should allow navigation file to be in subdirectory of module', () => {
    const navContents = heredoc`
      .By Level
      * xref:index.adoc[Basics]
       ** xref:basics:requirements.adoc[Requirements]
      * xref:advanced:index.adoc[Advanced]
       ** xref:advanced:caching.adoc[Caching]
    `
    const contentCatalog = mockContentCatalog([
      {
        module: 'ROOT',
        family: 'nav',
        relative: 'nav/level.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { module: 'ROOT', family: 'page', relative: 'index.adoc' },
      { module: 'basics', family: 'page', relative: 'requirements.adoc' },
      { module: 'advanced', family: 'page', relative: 'index.adoc' },
      { module: 'advanced', family: 'page', relative: 'caching.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'By Level',
      items: [
        {
          content: 'Basics',
          url: '/component-a/index.html',
          urlType: 'internal',
          items: [
            {
              content: 'Requirements',
              url: '/component-a/basics/requirements.html',
              urlType: 'internal',
            },
          ],
        },
        {
          content: 'Advanced',
          url: '/component-a/advanced/index.html',
          urlType: 'internal',
          items: [
            {
              content: 'Caching',
              url: '/component-a/advanced/caching.html',
              urlType: 'internal',
            },
          ],
        },
      ],
    })
  })

  it('should be able to reference attributes from AsciiDoc config', () => {
    const navContents = heredoc`
      .xref:index.adoc[{product-name}]
      * {site-url}[{site-title}]
      // a comment about this preprocessor conditional
      ifdef::go-live[]
      * {uri-console}
      endif::[]
      * {uri-project}[{project-name}]
    `
    const playbook = {
      site: {
        title: 'Docs',
        url: 'https://docs.example.org',
      },
      asciidoc: {
        attributes: {
          'hide-uri-scheme': '',
          'go-live': '',
          'product-name': 'Z Product',
          'project-name': 'Z Project',
          'uri-console': 'https://z-product.example.com/console',
          'uri-project': 'https://z-project.example.com',
        },
      },
    }
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const componentVersion = contentCatalog.getComponentVersion('component-a', '')
    componentVersion.asciidoc = resolveAsciiDocConfig(playbook)
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Z Product',
      url: '/component-a/module-a/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'Docs',
          url: 'https://docs.example.org',
          urlType: 'external',
        },
        {
          content: 'z-product.example.com/console',
          roles: 'bare',
          url: 'https://z-product.example.com/console',
          urlType: 'external',
        },
        {
          content: 'Z Project',
          url: 'https://z-project.example.com',
          urlType: 'external',
        },
      ],
    })
  })

  it('should be able to reference implicit page attributes', () => {
    const navContents = heredoc`
      .xref:index.adoc[{page-component-title}]
      * xref:{page-module}:page-a.adoc[Page A, v{page-version}]
    `
    const contentCatalog = mockContentCatalog([
      {
        version: '1.0',
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { version: '1.0', family: 'page', relative: 'index.adoc' },
      { version: '1.0', family: 'page', relative: 'page-a.adoc' },
    ])
    contentCatalog.getComponent('component-a').title = 'Component A'
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '1.0')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Component A',
      url: '/component-a/1.0/module-a/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'Page A, v1.0',
          url: '/component-a/1.0/module-a/page-a.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should build navigation list when doctype is set to book', () => {
    const navContents = heredoc`
      :doctype: book

      .xref:index.adoc[{module-a-name}]
      * xref:requirements.adoc[Requirements]
    `
    const playbook = {
      asciidoc: {
        // NOTE pass the name of module A as an attribute to be sure other attributes are present
        attributes: { doctype: 'book', 'module-a-name': 'Module A' },
      },
    }
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
      { family: 'page', relative: 'requirements.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog, resolveAsciiDocConfig(playbook))
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Module A',
      url: '/component-a/module-a/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'Requirements',
          url: '/component-a/module-a/requirements.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should allow items to link to external URLs or fragments', () => {
    const navContents = heredoc`
      .xref:asciidoc/index.adoc[AsciiDoc]
      * xref:asciidoc/syntax-primer.adoc[Syntax Primer]
      * https://asciidoctor.org/docs/user-manual/[Asciidoctor User Manual]
      * link:#[Back to top]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'asciidoc/index.adoc' },
      { family: 'page', relative: 'asciidoc/syntax-primer.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'AsciiDoc',
      url: '/component-a/module-a/asciidoc/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'Syntax Primer',
          url: '/component-a/module-a/asciidoc/syntax-primer.html',
          urlType: 'internal',
        },
        {
          content: 'Asciidoctor User Manual',
          url: 'https://asciidoctor.org/docs/user-manual/',
          urlType: 'external',
        },
        {
          content: 'Back to top',
          hash: '#',
          url: '#',
          urlType: 'fragment',
        },
      ],
    })
  })

  // Q: should we allow link to be anywhere in content?
  it('should only recognize a single link per item', () => {
    const navContents = heredoc`
      .Module A
      * xref:page-a.adoc[Page A] xref:page-b.adoc[Page B]
      * See xref:page-c.adoc[Page C]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'page-a.adoc' },
      { family: 'page', relative: 'page-b.adoc' },
      { family: 'page', relative: 'page-c.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Module A',
      items: [
        {
          content: 'Page A',
          url: '/component-a/module-a/page-a.html',
          urlType: 'internal',
        },
        {
          content: 'Page C',
          url: '/component-a/module-a/page-c.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should not set url or urlType if entry contains an anchor element without an href', () => {
    const navContents = heredoc`
      .Basics
      * [[category-a]]Category A
      * [[category-b]]Category B
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'page-a.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Basics',
      items: [{ content: '<a id="category-a"></a>Category A' }, { content: '<a id="category-b"></a>Category B' }],
    })
  })

  it('should allow navigation items to be text-only', () => {
    const navContents = heredoc`
      .Module A
      * Basics
       ** xref:installation.adoc[Installation]
      * Advanced
       ** xref:tuning-performance.adoc[Tuning Performance]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'installation.adoc' },
      { family: 'page', relative: 'tuning-performance.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Module A',
      items: [
        {
          content: 'Basics',
          items: [
            {
              content: 'Installation',
              url: '/component-a/module-a/installation.html',
              urlType: 'internal',
            },
          ],
        },
        {
          content: 'Advanced',
          items: [
            {
              content: 'Tuning Performance',
              url: '/component-a/module-a/tuning-performance.html',
              urlType: 'internal',
            },
          ],
        },
      ],
    })
  })

  it('should allow navigation items to contain formatted text', () => {
    const navContents = heredoc`
      ._Module A_
      * *Commands*
       ** xref:command/install.adoc[Install (\`i\`)]
       ** xref:command/remove.adoc[Remove (\`rm\`)]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'command/install.adoc' },
      { family: 'page', relative: 'command/remove.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: '<em>Module A</em>',
      items: [
        {
          content: '<strong>Commands</strong>',
          items: [
            {
              content: 'Install (<code>i</code>)',
              url: '/component-a/module-a/command/install.html',
              urlType: 'internal',
            },
            {
              content: 'Remove (<code>rm</code>)',
              url: '/component-a/module-a/command/remove.html',
              urlType: 'internal',
            },
          ],
        },
      ],
    })
  })

  it('should allow navigation items to be nested (up to 5 levels)', () => {
    const navContents = heredoc`
      * xref:basics.adoc[Basics]
       ** xref:install.adoc[Install]
        *** xref:install/desktop.adoc[Desktop]
         **** xref:install/linux.adoc[Linux]
          ***** xref:install/fedora.adoc[Fedora]
      * xref:requirements.adoc[Requirements]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'basics.adoc' },
      { family: 'page', relative: 'install.adoc' },
      { family: 'page', relative: 'install/desktop.adoc' },
      { family: 'page', relative: 'install/linux.adoc' },
      { family: 'page', relative: 'install/fedora.adoc' },
      { family: 'page', relative: 'requirements.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Basics',
          url: '/component-a/module-a/basics.html',
          urlType: 'internal',
          items: [
            {
              content: 'Install',
              url: '/component-a/module-a/install.html',
              urlType: 'internal',
              items: [
                {
                  content: 'Desktop',
                  url: '/component-a/module-a/install/desktop.html',
                  urlType: 'internal',
                  items: [
                    {
                      content: 'Linux',
                      url: '/component-a/module-a/install/linux.html',
                      urlType: 'internal',
                      items: [
                        {
                          content: 'Fedora',
                          url: '/component-a/module-a/install/fedora.html',
                          urlType: 'internal',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          content: 'Requirements',
          url: '/component-a/module-a/requirements.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should allow items to be nested inside an open block', () => {
    const navContents = heredoc`
      * xref:get-started.adoc[Get Started]
       ** xref:installation.adoc[Installation]
      +
      --
      * xref:installation/development.adoc[Development]
      * xref:installation/production.adoc[Production]
      --
       ** xref:upgrade.adoc[Upgrade]
      * xref:tutorials.adoc[Tutorials]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'get-started.adoc' },
      { family: 'page', relative: 'installation.adoc' },
      { family: 'page', relative: 'installation/development.adoc' },
      { family: 'page', relative: 'installation/production.adoc' },
      { family: 'page', relative: 'upgrade.adoc' },
      { family: 'page', relative: 'tutorials.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Get Started',
          url: '/component-a/module-a/get-started.html',
          urlType: 'internal',
          items: [
            {
              content: 'Installation',
              url: '/component-a/module-a/installation.html',
              urlType: 'internal',
              items: [
                {
                  content: 'Development',
                  url: '/component-a/module-a/installation/development.html',
                  urlType: 'internal',
                },
                {
                  content: 'Production',
                  url: '/component-a/module-a/installation/production.html',
                  urlType: 'internal',
                },
              ],
            },
            {
              content: 'Upgrade',
              url: '/component-a/module-a/upgrade.html',
              urlType: 'internal',
            },
          ],
        },
        {
          content: 'Tutorials',
          url: '/component-a/module-a/tutorials.html',
          urlType: 'internal',
        },
      ],
    })
  })

  // NOTE Asciidoctor messes up structure in this case unless first child is attached with a list continuation
  it('should fuse sibling list items with list items inside open block', () => {
    const navContents = heredoc`
      * User Interface
      +
       ** xref:ui/overview.adoc[Overview]

      +
      --
      * Layouts
       ** xref:ui/layouts/overview.adoc[Overview]
       ** xref:ui/layouts/responsive.adoc[Responsive UIs]
      --
       ** xref:ui/notifications.adoc[Notifications]

      +
      --
      * Search
       ** xref:ui/search/overview.adoc[Overview]
       ** xref:ui/search/query-suggestions.adoc[Query Suggestions]
       ** xref:ui/search/configuration.adoc[Configuration]
      --
       ** xref:ui/drag-drop.adoc[Drag & Drop]
      * xref:app-data.adoc[App Data]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'ui/overview.adoc' },
      { family: 'page', relative: 'ui/layouts/overview.adoc' },
      { family: 'page', relative: 'ui/layouts/responsive.adoc' },
      { family: 'page', relative: 'ui/notifications.adoc' },
      { family: 'page', relative: 'ui/search/overview.adoc' },
      { family: 'page', relative: 'ui/search/query-suggestions.adoc' },
      { family: 'page', relative: 'ui/search/configuration.adoc' },
      { family: 'page', relative: 'ui/drag-drop.adoc' },
      { family: 'page', relative: 'app-data.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'User Interface',
          items: [
            {
              content: 'Overview',
              url: '/component-a/module-a/ui/overview.html',
              urlType: 'internal',
            },
            {
              content: 'Layouts',
              items: [
                {
                  content: 'Overview',
                  url: '/component-a/module-a/ui/layouts/overview.html',
                  urlType: 'internal',
                },
                {
                  content: 'Responsive UIs',
                  url: '/component-a/module-a/ui/layouts/responsive.html',
                  urlType: 'internal',
                },
              ],
            },
            {
              content: 'Notifications',
              url: '/component-a/module-a/ui/notifications.html',
              urlType: 'internal',
            },
            {
              content: 'Search',
              items: [
                {
                  content: 'Overview',
                  url: '/component-a/module-a/ui/search/overview.html',
                  urlType: 'internal',
                },
                {
                  content: 'Query Suggestions',
                  url: '/component-a/module-a/ui/search/query-suggestions.html',
                  urlType: 'internal',
                },
                {
                  content: 'Configuration',
                  url: '/component-a/module-a/ui/search/configuration.html',
                  urlType: 'internal',
                },
              ],
            },
            {
              content: 'Drag &amp; Drop',
              url: '/component-a/module-a/ui/drag-drop.html',
              urlType: 'internal',
            },
          ],
        },
        {
          content: 'App Data',
          url: '/component-a/module-a/app-data.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should skip block which is not an unordered list or an unordered list wrapped inside an open block', () => {
    const navContents = heredoc`
      * Testing
      +
      Testing is good.
      +
       ** xref:testing/overview.adoc[Overview]

      +
      --
      Never leave testing for production.
      --
      +
      --
      // But everyone still tests in production.
      --
      +
      --
      * Writing effective unit tests
       ** xref:testing/unit-tests/overview.adoc[Overview]
       ** xref:testing/unit-tests/mocks-stubs.adoc[Mocks & Stubs]
      --
      * Performance
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'testing/overview.adoc' },
      { family: 'page', relative: 'testing/unit-tests/overview.adoc' },
      { family: 'page', relative: 'testing/unit-tests/mocks-stubs.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Testing',
          items: [
            {
              content: 'Overview',
              url: '/component-a/module-a/testing/overview.html',
              urlType: 'internal',
            },
            {
              content: 'Writing effective unit tests',
              items: [
                {
                  content: 'Overview',
                  url: '/component-a/module-a/testing/unit-tests/overview.html',
                  urlType: 'internal',
                },
                {
                  content: 'Mocks &amp; Stubs',
                  url: '/component-a/module-a/testing/unit-tests/mocks-stubs.html',
                  urlType: 'internal',
                },
              ],
            },
          ],
        },
        {
          content: 'Performance',
        },
      ],
    })
  })

  it('should process navigation file containing multiple lists', () => {
    const navContents = heredoc`
      .xref:basics.adoc[Basics]
      * xref:requirements.adoc[Requirements]

      .xref:hosting.adoc[Hosting]
      * xref:gitlab-pages.adoc[GitLab Pages]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'basics.adoc' },
      { family: 'page', relative: 'requirements.adoc' },
      { family: 'page', relative: 'hosting.adoc' },
      { family: 'page', relative: 'gitlab-pages.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(2)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Basics',
      url: '/component-a/module-a/basics.html',
      urlType: 'internal',
      items: [
        {
          content: 'Requirements',
          url: '/component-a/module-a/requirements.html',
          urlType: 'internal',
        },
      ],
    })
    expect(menu[1]).to.eql({
      order: 0.5,
      root: true,
      content: 'Hosting',
      url: '/component-a/module-a/hosting.html',
      urlType: 'internal',
      items: [
        {
          content: 'GitLab Pages',
          url: '/component-a/module-a/gitlab-pages.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should order trees from multiple navigation files by index of navigation file', () => {
    const contentCatalog = mockContentCatalog([
      {
        module: 'module-a',
        family: 'nav',
        relative: 'nav.adoc',
        contents: '.xref:index.adoc[Module A]\n* xref:the-page.adoc[Page in A]',
        navIndex: 2,
      },
      {
        module: 'module-b',
        family: 'nav',
        relative: 'nav.adoc',
        contents: '.xref:index.adoc[Module B]\n* xref:the-page.adoc[Page in B]',
        navIndex: 3,
      },
      {
        module: 'module-c',
        family: 'nav',
        relative: 'nav.adoc',
        contents: heredoc`
          .xref:index.adoc[Module C]
          * xref:the-page.adoc[Page in C]

          .xref:more/index.adoc[More Module C]
          * xref:more/the-page.adoc[Page in More C]
        `,
        navIndex: 1,
      },
      {
        module: 'module-d',
        family: 'nav',
        relative: 'nav.adoc',
        contents: '.xref:index.adoc[Module D]\n* xref:the-page.adoc[Page in D]',
        navIndex: 0,
      },
      { module: 'module-a', family: 'page', relative: 'index.adoc' },
      { module: 'module-a', family: 'page', relative: 'the-page.adoc' },
      { module: 'module-b', family: 'page', relative: 'index.adoc' },
      { module: 'module-b', family: 'page', relative: 'the-page.adoc' },
      { module: 'module-c', family: 'page', relative: 'index.adoc' },
      { module: 'module-c', family: 'page', relative: 'the-page.adoc' },
      { module: 'module-c', family: 'page', relative: 'more/index.adoc' },
      { module: 'module-c', family: 'page', relative: 'more/the-page.adoc' },
      { module: 'module-d', family: 'page', relative: 'index.adoc' },
      { module: 'module-d', family: 'page', relative: 'the-page.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(5)
    expect(menu[0].root).to.be.true()
    expect(menu[0].order).to.equal(0)
    expect(menu[0].content).to.equal('Module D')
    expect(menu[1].root).to.be.true()
    expect(menu[1].order).to.equal(1)
    expect(menu[1].content).to.equal('Module C')
    expect(menu[2].root).to.be.true()
    expect(menu[2].order).to.equal(1.5)
    expect(menu[2].content).to.equal('More Module C')
    expect(menu[3].root).to.be.true()
    expect(menu[3].order).to.equal(2)
    expect(menu[3].content).to.equal('Module A')
    expect(menu[4].root).to.be.true()
    expect(menu[4].order).to.equal(3)
    expect(menu[4].content).to.equal('Module B')
  })

  it('should skip blocks that are not unordered lists', () => {
    const navContents = heredoc`
      This paragraph should be skipped.

      .xref:basics.adoc[Basics]
      * xref:requirements.adoc[Requirements]
       .. This list should be discarded.
        *** This list should not be recognized.

      ----
      This listing block is ignored.
      ----

      .xref:hosting.adoc[Hosting]
      * xref:gitlab-pages.adoc[GitLab Pages]

      //^
      . This list should be thrown away.
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'basics.adoc' },
      { family: 'page', relative: 'requirements.adoc' },
      { family: 'page', relative: 'hosting.adoc' },
      { family: 'page', relative: 'gitlab-pages.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(2)
    expect(menu[0].content).to.equal('Basics')
    expect(menu[1].content).to.equal('Hosting')
  })

  it('should skip navigation file if it contains no unordered lists', () => {
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: 'Sorry, no lists here :(',
        navIndex: 0,
      },
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: '.Basics\n* xref:first-steps.adoc[First Steps]',
        navIndex: 1,
      },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0].content).to.equal('Basics')
  })

  it('should resolve include target prefixed with {partialsdir} in navigation file', () => {
    const navContents = heredoc`
      .xref:index.adoc[Basics]
      include::{partialsdir}/nav/basics.adoc[]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      {
        family: 'partial',
        relative: 'nav/basics.adoc',
        contents: '* xref:basics/requirements.adoc[Requirements]',
      },
      { family: 'page', relative: 'index.adoc' },
      { family: 'page', relative: 'basics/requirements.adoc' },
    ]).spyOn('getById')
    const navCatalog = buildNavigation(contentCatalog, resolveAsciiDocConfig())
    expect(contentCatalog.getById).nth(1).called.with({
      component: 'component-a',
      version: '',
      module: 'module-a',
      family: 'partial',
      relative: 'nav/basics.adoc',
    })
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Basics',
      url: '/component-a/module-a/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'Requirements',
          url: '/component-a/module-a/basics/requirements.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should resolve include target resource ID in navigation file', () => {
    const navContents = heredoc`
      .xref:intermediate/index.adoc[Intermediate]
      include::partial$nav/intermediate.adoc[]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      {
        family: 'partial',
        relative: 'nav/intermediate.adoc',
        contents: '* xref:intermediate/redirects.adoc[Redirects]',
      },
      { family: 'page', relative: 'intermediate/index.adoc' },
      { family: 'page', relative: 'intermediate/redirects.adoc' },
    ]).spyOn('getById')
    const navCatalog = buildNavigation(contentCatalog, resolveAsciiDocConfig())
    expect(contentCatalog.getById).nth(1).called.with({
      component: 'component-a',
      version: '',
      module: 'module-a',
      family: 'partial',
      relative: 'nav/intermediate.adoc',
    })
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Intermediate',
      url: '/component-a/module-a/intermediate/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'Redirects',
          url: '/component-a/module-a/intermediate/redirects.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should resolve include target resource ID pointing to separate module in navigation file', () => {
    const navContents = heredoc`
      .xref:advanced:index.adoc[Advanced]
      include::advanced:partial$nav/advanced.adoc[]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      {
        module: 'advanced',
        family: 'partial',
        relative: 'nav/advanced.adoc',
        // FIXME can the module be inferred in this case?
        contents: '* xref:advanced:caching.adoc[Caching]',
      },
      { module: 'advanced', family: 'page', relative: 'index.adoc' },
      { module: 'advanced', family: 'page', relative: 'caching.adoc' },
    ]).spyOn('getById')
    const navCatalog = buildNavigation(contentCatalog, resolveAsciiDocConfig())
    expect(contentCatalog.getById).nth(1).called.with({
      component: 'component-a',
      version: '',
      module: 'advanced',
      family: 'partial',
      relative: 'nav/advanced.adoc',
    })
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      content: 'Advanced',
      url: '/component-a/advanced/index.html',
      urlType: 'internal',
      items: [
        {
          content: 'Caching',
          url: '/component-a/advanced/caching.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should route Asciidoctor log messages to Antora logger', () => {
    const navContents = heredoc`
      * xref:index.adoc[Home]
      include::no-such-file.adoc[]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const messages = captureLogSync(() => buildNavigation(contentCatalog))
    expect(messages).to.have.lengthOf(1)
    expect(messages[0]).to.eql({
      level: 'error',
      name: 'asciidoctor',
      file: { path: 'modules/module-a/nav.adoc', line: 2 },
      msg: 'target of include not found: no-such-file.adoc',
    })
  })

  //For all the 'title' tests I can't find the Ruby code that includes it.
  //Perhaps it was removed in Asciidoctor 2.
  it('should deal with role and title in list item', () => {
    const navContents = heredoc`
      * xref:index.adoc[Module A, role="icon-tic", title="bar"]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Module A',
          roles: 'icon-tic',
          title: 'bar',
          url: '/component-a/module-a/index.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should deal with multiple roles and title in list item', () => {
    const navContents = heredoc`
      * xref:index.adoc[Module A, role="icon-tic icon-toc icon-toe", title="bar"]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Module A',
          roles: 'icon-tic icon-toc icon-toe',
          title: 'bar',
          url: '/component-a/module-a/index.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should deal with multiple roles in list item', () => {
    const navContents = heredoc`
      * xref:index.adoc[Module A, role="icon-tic icon-toc icon-toe"]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Module A',
          roles: 'icon-tic icon-toc icon-toe',
          url: '/component-a/module-a/index.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should deal with multiple roles, window, and title in list item', () => {
    const navContents = heredoc`
      * xref:index.adoc[Module A, role="icon-tic icon-toc icon-toe", title="bar", window='_blank']
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Module A',
          rel: 'noopener',
          roles: 'icon-tic icon-toc icon-toe',
          target: '_blank',
          title: 'bar',
          url: '/component-a/module-a/index.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('should deal with multiple roles, opts=nofollow, and title in list item', () => {
    const navContents = heredoc`
      * xref:index.adoc[Module A, role="icon-tic icon-toc icon-toe", title="bar", opts=nofollow]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Module A',
          rel: 'nofollow',
          roles: 'icon-tic icon-toc icon-toe',
          title: 'bar',
          url: '/component-a/module-a/index.html',
          urlType: 'internal',
        },
      ],
    })
  })

  //I would expect `rel: 'nofollow noopener`. Perhaps this will change with Asciidoctor 2.
  it('should deal with multiple roles, window, opts=nofollow, and title in list item', () => {
    const navContents = heredoc`
      * xref:index.adoc[Module A, role="icon-tic icon-toc icon-toe", title="bar", window=_blank, ops=nofollow]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Module A',
          rel: 'noopener',
          roles: 'icon-tic icon-toc icon-toe',
          target: '_blank',
          title: 'bar',
          url: '/component-a/module-a/index.html',
          urlType: 'internal',
        },
      ],
    })
  })

  it('external link works with roles', () => {
    const navContents = heredoc`
      * https://example.com[Example, role="icon-tic icon-toc icon-toe", title="bar", window=_blank, ops=nofollow]
    `
    const contentCatalog = mockContentCatalog([
      {
        family: 'nav',
        relative: 'nav.adoc',
        contents: navContents,
        navIndex: 0,
      },
      { family: 'page', relative: 'index.adoc' },
    ])
    const navCatalog = buildNavigation(contentCatalog)
    const menu = navCatalog.getNavigation('component-a', '')
    expect(menu).to.exist()
    expect(menu).to.have.lengthOf(1)
    expect(menu[0]).to.eql({
      order: 0,
      root: true,
      items: [
        {
          content: 'Example',
          rel: 'noopener',
          roles: 'icon-tic icon-toc icon-toe',
          target: '_blank',
          title: 'bar',
          url: 'https://example.com',
          urlType: 'external',
        },
      ],
    })
  })
})
