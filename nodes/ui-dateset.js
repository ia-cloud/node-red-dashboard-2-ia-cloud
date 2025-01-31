module.exports = function (RED) {


    function UIDateSetNode(config) {
        RED.nodes.createNode(this, config)

        var moment = require("moment");

        const node = this

        // which group are we rendering this widget
        const group = RED.nodes.getNode(config.group)

        const base = group.getBase()


        /*
        var group = RED.nodes.getNode(config.group);
        if (!group && config.templateScope !== 'global') { return; }
        var tab = null;
        if (config.templateScope !== 'global') {
            tab = RED.nodes.getNode(group.config.tab);
            if (!tab) { return; }
        }
        */

        // サイズ調整
        if (config.width === "0") { delete config.width; }
        if (config.height === "0") { delete config.height; }
        // number of pixels wide the chart will be... 43 = sizes.sx - sizes.px
        // var pixelsWide = ((config.width || group.config.width || 6) - 1) * 43 - 15;

        var previousTemplate = null;

        // server-side event handlers
        const evts = {
            onAction: true,
            onInput: function (msg, send, done) {
                // store the latest value in our Node-RED datastore
                base.stores.data.save(base, node, msg)
                // send it to any connected nodes in Node-RED
                send(msg)
            },
            onSocket: {
                'dateset-event': function (conn, id, msg) {
                    console.info('"dateset-event" received:', conn.id, id, msg)
                    console.info('conn.id:', conn.id)
                    console.info('id:', id)
                    console.info('msg:', msg)
                    console.info('node.id:', node.id)

                    if (msg.payload.sdatetime != undefined && msg.payload.sdatetime != null) {
                        msg.payload.sdatetime = moment(msg.payload.sdatetime).format("YYYY-MM-DDTHH:mm:ss");
                    } else {
                        msg.payload.sdatetime = undefined;
                    }
                    if (msg.payload.edatetime != undefined && msg.payload.edatetime != null) {
                        msg.payload.edatetime = moment(msg.payload.edatetime).format("YYYY-MM-DDTHH:mm:ss");
                    } else {
                        msg.payload.edatetime = undefined;
                    }

                    if (msg.payload.sdatetime == undefined) {
                        var sendJson = {
                            edatetime: msg.payload.edatetime
                        }
                    } else if (msg.payload.edatetime == undefined) {
                        var sendJson = {
                            sdatetime: msg.payload.sdatetime
                        }
                    } else {
                        var sendJson = {
                            sdatetime: msg.payload.sdatetime,
                            edatetime: msg.payload.edatetime
                        }
                    }


                    // emit a msg in Node-RED from this node
                    node.send({ payload: sendJson })
                }
            }
        }

        // inform the dashboard UI that we are adding this node
        if (group) {
            group.register(node, config, evts)
        } else {
            node.error('No group configured')
        }
    }

    RED.nodes.registerType('ui-dateset-2', UIDateSetNode)
}
