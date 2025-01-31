module.exports = function (RED) {
    function UINumDtNode(config) {
        var moment = require('moment');
        RED.nodes.createNode(this, config);

        const node = this;

        // which group are we rendering this widget
        const group = RED.nodes.getNode(config.group);

        const base = group.getBase();

        var conf_ds = JSON.parse(config.display_settings);      // 表示形式
        var datatype = config.datatype;                         // データ型

        var label = config.label;
        if  (label == undefined) {
            label = "";
        }

        // サイズ調整
        if (config.width === "0") { delete config.width; };
        if (config.height === "0") { delete config.height; };

        var previousTemplate = null

        // server-side event handlers
        const evts = {
            onAction: true,
            onInput: function (msg, send, done) {
                var new_value = [];
                if(datatype == "Number"){
                    var value = msg.payload;
                } else if(datatype == "Datetime"){
                    var value = [];
                    for(obj of msg.payload){
                        // value.push(obj.date);
                        value.push(Object.values(obj)[0]);
                    }
                }
                for(idx in value){
                    if(conf_ds[idx] === undefined){
                        conf_ds[idx] = {};
                    }
                    new_value[idx] = {};
                    if(datatype == "Number"){
                        new_value[idx].label = conf_ds[idx].label || value[idx][0];
                        new_value[idx].value = (conf_ds[idx].digits) ? Number(value[idx][1]).toFixed(conf_ds[idx].digits) : value[idx][1];
                        new_value[idx].units = conf_ds[idx].units || value[idx][2];
                    }else if(datatype == "Datetime"){
                        new_value[idx].label = conf_ds[idx].dt_label || '';
                        new_value[idx].datetime = moment(value[idx]).format(conf_ds[idx].format) || value[idx];
                    }
                }
                msg.payload = new_value;

                node.status({fill:"green", shape:"dot", text:"runtime.complete"});

                // store the latest value in our Node-RED datastore
                base.stores.data.save(base, node, msg);
                // send it to any connected nodes in Node-RED
                send(msg);

            },
            onSocket: {
                "num_dt-event": function (conn, id, msg) {
                    console.info('"num_dt-event" received:', conn.id, id, msg);
                    console.info("conn.id:", conn.id);
                    console.info("id:", id);
                    console.info("msg:", msg);
                    console.info("node.id:", node.id);

                    // emit a msg in Node-RED from this node
                    node.send({ payload: sendJson });
                },
            },
        };

        // inform the dashboard UI that we are adding this node
        if (group) {
            group.register(node, config, evts);
        } else {
            node.error("No group configured");
        }
    }

    RED.nodes.registerType("ui-num-dt-2", UINumDtNode);
};
