module.exports = function (RED) {
    function UITableNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;

        // which group are we rendering this widget
        const group = RED.nodes.getNode(config.group);

        const base = group.getBase();

        var confsel = config.confsel;
        var contype1 = config.contype1;
        var contype2 = config.contype2;
        var item = config.item;

        var label = config.label;
        if (label == undefined) {
            label = "";
        }

        try {
            var statusList = config.statuslist.split(",");
        } catch (e) {
            var statusList = [];
        }

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
        if (config.width === "0") {
            delete config.width;
        }
        if (config.height === "0") {
            delete config.height;
        }
        // number of pixels wide the chart will be... 43 = sizes.sx - sizes.px
        // var pixelsWide = ((config.width || group.config.width || 6) - 1) * 43 - 15;

        var previousTemplate = null;

        // server-side event handlers
        const evts = {
            onAction: true,
            onInput: function (msg, send, done) {
                node.status({ fill: "blue", shape: "dot", text: "runtime.connect" });
                // 入力値によって分岐
                switch (confsel) {
                    case "dynamodbSet":
                    // contentTypeを基にデータ作成
                    switch (contype1) {
                        case "Alarm&Event":
                            msg.series = ["timestamp", "No", "エラー詳細", "ステータス"];
                            itemList = msg.payload.Items;

                            dataAry = []; // 出力用データ一時保存用
                            var temp = []; // 出力用データ保存用
                            var contentList; // 取得データ一時保存

                            if (itemList != undefined) {
                                for (i = 0; i < itemList.length; i++) {  //データ件数でループ
                                    try {
                                        if (itemList[i].dataObject.objectContent != undefined) {
                                            contentList = itemList[i].dataObject.objectContent.contentData;
                                        } else if (itemList[i].dataObject.ObjectContent != undefined) {
                                            contentList = itemList[i].dataObject.ObjectContent.contentData;
                                        } else {
                                            node.status({fill: "yellow", shape: "ring", text: "runtime.noObjCnt"});
                                            continue;
                                        }
                            } catch (e) {
                                node.status({fill: "yellow", shape: "ring", text: "runtime.noObjCnt"});
                                continue;
                            }

                            if (contentList.length > 0) {
                                var conIdx;
                                for (conIdx = 0; conIdx < contentList.length; conIdx++) {
                                    if (contentList[conIdx].commonName === "Alarm&Event" && contentList[conIdx].dataValue != undefined) {
                                        if (statusList.indexOf(contentList[conIdx].dataValue.AnEStatus) != -1) {
                                            // 情報をdataAryに格納
                                            if (itemList[i].timestamp != undefined) {
                                                temp.push(itemList[i].timestamp);
                                            } else {
                                                temp.push(itemList[i].timeStamp);
                                            }
                                            temp.push(contentList[conIdx].dataValue.AnECode);
                                            temp.push(contentList[conIdx].dataValue.AnEDescription);
                                            temp.push(contentList[conIdx].dataValue.AnEStatus);

                                            dataAry.push(temp);
                                            temp = [];
                                        }
                                    } else {
                                        node.status({fill: "yellow", shape: "ring", text: "runtime.noConType"});
                                    }
                                }
                            }
                        }
                    }
                    node.status({fill: "green", shape: "dot", text: "runtime.complete"});
                    break;
                    default:
                        node.error("contentType：対象外の集計データです");
                        node.status({fill: "yellow", shape: "ring", text: "runtime.noConType"});
                        dataAry = [];
                    }
                    msg.payload = dataAry;
                    break;

                case "inchartSet":
                switch (contype2) {
                    case "iaCloudData":
                    default:
                        try {
                            dataAry = []; // 出力用データ一時保存用
                            var temp = []; // 出力用データ保存用

                            // DashBoard1.0の入力形式の場合
                            if ("data" in msg.payload[0]) {
                                msg.series = msg.payload[0].series;
                                data = msg.payload[0].data;
                            }
                            // DashBoard2.0の入力形式の場合
                            else {
                                series = [];
                                for (var i = 0; i < msg.payload.length; i++) {
                                    series.push(msg.payload[i].series);
                                }
                                // 重複削除
                                msg.series = [...new Set(series)];

                                data = [];
                                temp_data = [];
                                series_len = msg.payload.length / msg.series.length;

                                for (var i = 0; i < msg.payload.length; i++) {
                                    if (i!== 0 && i % series_len == 0) {
                                        data.push(temp_data);
                                        temp_data = [];
                                    }
                                    temp_data.push({x: msg.payload[i].x, y: msg.payload[i].y});

                                    if (i == msg.payload.length-1) {
                                        data.push(temp_data);
                                    }
                                }
                            }
                            msg.series.unshift("timestamp");

                            for (var i = 0; i < data[0].length; i++) {
                                temp.push(data[0][i].x, data[0][i].y);
                                for (var j = 1; j < data.length; j++) {
                                    temp.push(data[j][i].y);
                                }
                                dataAry.push(temp);
                                temp = [];
                            }
                        } catch (e) {
                            node.status({fill: "yellow", shape: "ring", text: "runtime.formatError"});
                        }
                    }
                    msg.payload = dataAry;
                    break;

                    case "formatSet":
                        // 項目取得、配列に変換
                        msg.series = item.split(",");
                        break;
                        default:
                }

                if (msg.payload.length > 0) {
                    node.status({
                    fill: "green",
                    shape: "dot",
                    text: "runtime.complete",
                    });
                } else {
                    node.status({
                    fill: "yellow",
                    shape: "ring",
                    text: "runtime.noData",
                    });
                }

                // store the latest value in our Node-RED datastore
                base.stores.data.save(base, node, msg);
                // send it to any connected nodes in Node-RED
                send(msg);

            },
            onSocket: {
                "table-event": function (conn, id, msg) {
                    console.info('"table-event" received:', conn.id, id, msg);
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

    RED.nodes.registerType("ui-table-2", UITableNode);
};
