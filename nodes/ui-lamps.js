module.exports = function (RED) {
    function UILampsNode(config) {
        RED.nodes.createNode(this, config)

        const node = this

        // which group are we rendering this widget
        const group = RED.nodes.getNode(config.group)

        const base = group.getBase()

        var confsel = config.confsel;
        var label = config.label;

        const trueList = config.truelist.split(',');

        if (label == undefined) {
            label = "";
        }

        var statusObject;
        try {
            if (config.params != undefined) {
                statusObject = config.params;
            } else {
                statusObject = [];
            }
        } catch (e) {
            statusObject = [];
        }

        // no rule found
        if (statusObject.length === 0) {
            node.status({ fill: "yellow", shape: "ring", text: "runtime.noParam" });
        } else {
            node.status({});
        }

        var statusColorList = {};

        for (var i = 0; i < statusObject.length; i++) {
            statusColorList[statusObject[i].statusValue] = statusObject[i].statusColor;
        }

        // サイズ調整
        if (config.width === "0") { delete config.width; }
        if (config.height === "0") { delete config.height; }

        var previousTemplate = null;

        // server-side event handlers
        const evts = {
            onAction: true,
            onInput: function (msg, send, done) {
                node.status({ fill: "blue", shape: "dot", text: "runtime.connect" });
                var lamps = [];

                if (confsel == "inlatestSet" || confsel == "formatSet") {
                    let value = msg.payload;

                    const arr = Array.isArray(value) ? value : [value];
                    for (idx in arr) {
                        lamps[idx] = {
                            state: false,
                            color: config.params[idx].color,
                            phase: config.params[idx].phase,
                            name: config.params[idx].name
                        }
                        if ((arr[idx] == false && arr[idx] != "") || arr[idx] == "false" || arr[idx] == "0" || arr[idx] == "reset" || arr[idx] == "off") {
                            lamps[idx].state = false;
                        } else if (arr[idx] == true || arr[idx] == "true" || arr[idx] == "1" || arr[idx] == "set" || arr[idx] == "on" || trueList.indexOf(arr[idx]) > -1) {
                            lamps[idx].state = true;
                        }
                    }
                } else {
                    var data = msg.payload;
                    let nameList = [];
                    let valueList = [];
                    for (let item of data) {
                        nameList.push(item.series);
                        valueList.push(item.y);
                    }

                    for (idx in valueList) {
                        lamps[idx] = {
                            state: false,
                            color: config.params[idx].color,
                            phase: config.params[idx].phase,
                            name: config.params[idx].name
                        }
                        if ((valueList[idx] == false && valueList[idx] != "") || valueList[idx] == "false" || valueList[idx] == "0" || valueList[idx] == "reset" || valueList[idx] == "off") {
                            lamps[idx].state = false;
                        } else if (valueList[idx] == true || valueList[idx] == "true" || valueList[idx] == "1" || valueList[idx] == "set" || valueList[idx] == "on" || trueList.indexOf(valueList[idx]) > -1) {
                            lamps[idx].state = true;
                        }
                    }
                }
                msg.lamps = lamps;

                // store the latest value in our Node-RED datastore
                base.stores.data.save(base, node, msg)
                // send it to any connected nodes in Node-RED
                send(msg)
                node.status({ fill: "green", shape: "dot", text: "runtime.complete" });
            },
            onSocket: {
                'my-custom-event': function (conn, id, msg) {
                    console.info('"my-custom-event" received:', conn.id, id, msg)
                    console.info('conn.id:', conn.id)
                    console.info('id:', id)
                    console.info('msg:', msg)
                    console.info('node.id:', node.id)
                    // emit a msg in Node-RED from this node
                    node.send(msg)
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

    RED.nodes.registerType('ui-lamps-2', UILampsNode)
}
