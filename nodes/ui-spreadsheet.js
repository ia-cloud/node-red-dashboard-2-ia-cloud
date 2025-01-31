module.exports = function (RED) {
    function UISpreadSheetNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;

        // which group are we rendering this widget
        const group = RED.nodes.getNode(config.group);

        const base = group.getBase();

        var contype = config.contype;          // 集計対象のcontentType
        var item = config.item;                // 表示する項目
        var aneStatus = config.aneStatus;      // カウントするステータス

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
                node.status({fill:"blue", shape:"dot", text:"runtime.connect"});
                console.log("payload : ", msg.payload);
                itemList = msg.payload.Items;
                var contentList;                // 取得データ一時保存
                var resultList = [];            // 集計結果保存    [n][0]:AnEStatus, [n][1]:AnEDescription, [n][2]:カウント
                if (itemList != undefined) {
                    // A＆E 件数集計
                    for(i=0;i < itemList.length; i++) {  //データ件数でループ
                        try {
                            if (itemList[i].dataObject.objectContent != undefined) {
                                contentList = itemList[i].dataObject.objectContent.contentData;
                            } else if (itemList[i].dataObject.ObjectContent != undefined) {
                                contentList = itemList[i].dataObject.ObjectContent.contentData;
                            } else {
                                node.status({fill:"yellow", shape:"ring", text:"runtime.noObjCnt"});
                                continue;
                            }
                        } catch (e) {
                            node.status({fill:"yellow", shape:"ring", text:"runtime.noObjCnt"});
                            continue;
                        }
                        // 集計データごとに集計処理を実施
                        console.log("contype : ", contype);
                        switch (contype) {
                            case "Alarm&Event":
                                // contentListにデータ入っていたら検索開始
                                if (contentList.length > 0){
                                    var conIdx;
                                    for (conIdx=0; conIdx<contentList.length; conIdx++) {
                                        if (contentList[conIdx].commonName === "Alarm&Event" && contentList[conIdx].dataValue != undefined) {
                                            if (contentList[conIdx].dataValue.AnEStatus === aneStatus) {
                                                var rIdx;
                                                // 初回カウントデータ判定
                                                for (rIdx=0; rIdx<resultList.length; rIdx++) {
                                                    if (resultList[rIdx][0] === contentList[conIdx].dataValue.AnECode) {
                                                        break;
                                                    }
                                                }
                                                if (rIdx < resultList.length) {
                                                    // エラー詳細がresultList内に見つかった場合はカウントに+1
                                                    resultList[rIdx][2]++;
                                                } else {
                                                    // エラー詳細がresultList内に見つからなかった場合はカウント新規作成
                                                    resultList.push([contentList[conIdx].dataValue.AnECode, contentList[conIdx].dataValue.AnEDescription, 1]);
                                                }
                                            }

                                        }
                                    }
                                }
                                break;

                            default:
                                node.status({fill:"yellow", shape:"ring", text:"runtime.noConType"});
                        }
                    }
                }

                // 表示項目ごとに出力内容を設定
                switch (contype) {
                    case "Alarm&Event":
                    switch (item) {
                        case "nodesc":
                        msg.series = ["No", "詳細", "回数"];
                        msg.payload = resultList;
                        break;

                        case "no":
                        for (i=0;i < resultList.length; i++) {
                            resultList[i].splice(1, 1);
                        }
                        msg.series = ["No", "回数"];
                        msg.payload = resultList;
                        break;

                        case "desc":
                        for (i=0;i < resultList.length; i++) {
                            resultList[i].splice(0, 1);
                        }
                        msg.series = ["詳細", "回数"];
                        msg.payload = resultList;
                    }
                    break;

                    default:
                        node.status({fill:"yellow", shape:"ring", text:"runtime.noConType"});
                }

                if (msg.payload.length > 0) {
                    node.status({fill:"green", shape:"dot", text:"runtime.complete"});
                } else {
                    node.status({fill:"yellow", shape:"ring", text:"runtime.noData"});
                }
                console.log("msg.payload : ", msg.payload);

                // store the latest value in our Node-RED datastore
                base.stores.data.save(base, node, msg);
                // send it to any connected nodes in Node-RED
                send(msg);

            },
            onSocket: {
                "spreadsheet-event": function (conn, id, msg) {
                    console.info('"spreadsheet-event" received:', conn.id, id, msg);
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

    RED.nodes.registerType("ui-spreadsheet-2", UISpreadSheetNode);
};
