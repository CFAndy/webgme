({
    name:"client/js/client",
    out:"client.build.js",
    baseUrl:"./../src",
    paths:{
        util:"common/util",
        eventDispatcher:"common/EventDispatcher",
        core:"common/core",
        coreclient:"common/core/users",
        storage:"common/storage",
        logManager:"common/LogManager",
        blob:"middleware/blob",
        superagent:"../node_modules/superagent/superagent"
    },
    optimize:"none",
    insertRequire:["client/js/client"],
    include:['../node_modules/requirejs/require'],
    wrap:{
        start:"var WebGMEGlobal = WebGMEGlobal || {};(function(){",
        end:"}());"
    }
})