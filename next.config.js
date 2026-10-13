const fs = require('node:fs')
const path = require('node:path')
const BLOG = require('./blog.config')
const { extractLangPrefix } = require('./lib/utils/pageId')
const { isExport } = require('./lib/utils/buildMode')
const { getStaticPageGenerationTimeoutSec } = require('./lib/build/buildEnv')


const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: BLOG.BUNDLE_ANALYZER
})


const themes = scanSubdirectories(path.resolve(__dirname, 'themes'))


const locales = (function () {

  const langs = [BLOG.LANG]

  if (BLOG.NOTION_PAGE_ID.indexOf(',') > 0) {

    const siteIds = BLOG.NOTION_PAGE_ID.split(',')

    for (const siteId of siteIds) {

      const prefix = extractLangPrefix(siteId)

      if (prefix && !langs.includes(prefix)) {
        langs.push(prefix)
      }
    }
  }

  return langs

})()



// =============================
// Build前清理
// =============================
const preBuild = (function () {


  if (
    process.env.npm_lifecycle_event !== 'export' &&
    process.env.npm_lifecycle_event !== 'build'
  ) {
    return
  }


  const notionCacheRoot =
    path.resolve(__dirname, '.next', 'cache', 'notion')


  const dataDir =
    path.join(notionCacheRoot, 'data')


  const prefetchDir =
    path.join(notionCacheRoot, 'sessions')


  const sessionFile =
    path.join(notionCacheRoot, 'build-session.json')


  // EdgeOne CI环境建议清理
  if (
    process.env.NOTION_BUILD_CACHE_PURGE_DATA === 'true'
  ) {

    fs.rmSync(
      dataDir,
      {
        recursive:true,
        force:true
      }
    )

    console.log(
      'Purged Notion cache'
    )

  }


  fs.rmSync(
    prefetchDir,
    {
      recursive:true,
      force:true
    }
  )


  fs.mkdirSync(
    notionCacheRoot,
    {
      recursive:true
    }
  )


  fs.writeFileSync(
    sessionFile,
    JSON.stringify(
      {
        createdAt:new Date().toISOString()
      },
      null,
      2
    )
  )


})()



function scanSubdirectories(directory){

  const result=[]

  fs.readdirSync(directory)
    .forEach(file=>{

      const fullPath =
        path.join(directory,file)

      if(
        fs.statSync(fullPath).isDirectory()
      ){
        result.push(file)
      }

    })

  return result
}



function getOutput(){

  if(isExport()){
    return 'export'
  }

  if(
    process.env.NEXT_BUILD_STANDALONE === 'true'
  ){
    return 'standalone'
  }

  return undefined
}




const nextConfig = {


  eslint:{
    ignoreDuringBuilds:true
  },


  output:getOutput(),


  staticPageGenerationTimeout:
    getStaticPageGenerationTimeoutSec(),



  // =====================
  // 基础优化
  // =====================

  compress:true,

  poweredByHeader:false,

  generateEtags:true,



  // 删除 swcMinify
  // Next15已经默认开启



  modularizeImports:{

    '@heroicons/react/24/outline':{
      transform:
        '@heroicons/react/24/outline/{{member}}'
    },

    '@heroicons/react/24/solid':{
      transform:
        '@heroicons/react/24/solid/{{member}}'
    }

  },



  // =====================
  // 图片优化
  // OSS场景关闭Next Image
  // =====================

  images:{

    unoptimized:true,


    remotePatterns:[

      {
        protocol:'https',
        hostname:'**'
      },

      {
        protocol:'http',
        hostname:'**'
      }

    ]

  },



  // =====================
  // webpack优化
  // =====================

  webpack:(config,{dev,isServer})=>{


    // EdgeOne临时构建空间优化
    if(!dev){

      config.cache=false

    }



    config.ignoreWarnings=[

      ...(config.ignoreWarnings || []),

      {

        module:
        /[\\/]next[\\/]dist[\\/]esm[\\/]client[\\/]components[\\/]navigation\.js$/,


        message:
        /useContext.*not exported from ['"]react['"]/i

      }

    ]



    config.resolve.alias['@'] =
      path.resolve(__dirname)


    config.resolve.alias['lodash.throttle'] =
      path.resolve(
        __dirname,
        'lib/utils/throttle.js'
      )



    if(!isServer){

      config.resolve.fallback={

        ...config.resolve.fallback,

        fs:false,
        net:false,
        tls:false,
        dns:false,
        path:false

      }

    }


    return config

  },



  experimental:{

    // EdgeOne免费构建环境建议限制
    cpus:1,


    scrollRestoration:true,


    optimizePackageImports:[

      '@heroicons/react',

      'lodash'

    ]

  },



  exportPathMap:function(
    defaultPathMap
  ){

    const pages={
      ...defaultPathMap
    }


    delete pages['/sitemap.xml']

    delete pages['/auth']


    return pages

  },


  publicRuntimeConfig:{

    THEMES:themes

  }


}



module.exports =
  process.env.ANALYZE
    ? withBundleAnalyzer(nextConfig)
    : nextConfig
