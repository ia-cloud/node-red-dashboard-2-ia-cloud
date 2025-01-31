module.exports = function (RED) {


    function UIOprStatusNode(config) {
        RED.nodes.createNode(this, config)

        var moment = require("moment");

        const node = this

        // which group are we rendering this widget
        const group = RED.nodes.getNode(config.group)

        const base = group.getBase()

        var confsel = config.confsel;
        var item = config.item;
        var label = config.label;
        var sort = config.sort;				// 並び順

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

        var data;                       // 出力データ
        var graphData;                  // グラフ表示部分データ
        var xaxisData;                  // X軸表示用データ

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
                data = [];              // 出力データ
                graphData = [];         // グラフ表示部分データ
                xaxisData = [];         // X軸表示用データ
                try {
                    if (confsel == "inchartSet") {

                        // 項目名に入力がなかった場合、series[0]を表示する
                        msg.series = [];
                        if (item != undefined) {
                            msg.series.push(item);
                        } else {
                            msg.series.push(msg.payload[0].series);
                        }

                        // 有効データ(一件目)のみを取得、dataへ格納
                        data = msg.payload;

                    } else {
                        // 項目名を取得
                        msg.series = [];
                        msg.series.push(item);

                        // 取得データのフォーマット変換、dataへ格納
                        var tempData = msg.payload;

                        for (var i = 0; i < tempData.length; i++) {
                            var tempObj = {
                                "x": tempData[i][0],
                                "y": tempData[i][1]
                            }
                            data.push(tempObj);
                        }
                    }

                    // グラフ表示部分のデータ作成
                    for (var i = 0; i < data.length; i++) {
                        graphData.push(data[i]);
                    }

                    // 各データの状況開始日時・終了日時、割合を算出・格納処理
                    for (var i = 0; i < graphData.length - 1; i++) {
                        graphData[i].statusColor = statusColorList[graphData[i].y];
                    }

                    graphData[graphData.length - 1].statusColor = statusColorList[graphData[graphData.length - 1].y];


                    var tempDate;
                    for (var i = 0; i < data.length - 1; i++) {
                        // 有効な軸データの場合、フォーマット変換して保存
                        try {
                            tempDate = moment(data[i].x);
                            xaxisData.push({ x: tempDate.format('YYYY-MM-DD HH:mm:ss') });
                        } catch (e) {
                            xaxisData.push({ x: "" });
                        }
                    }

                    // 最終データの変換
                    try {
                        tempDate = moment(data[data.length - 1].x);
                        xaxisData.push({ x: tempDate.format('YYYY-MM-DD HH:mm:ss') });
                    } catch (e) {
                        xaxisData.push({ x: "" });
                    }

                    // X軸表示データの間引き
                    if (xaxisData.length > 5) {
                        cenInd = Math.floor(xaxisData.length / 2);
                        leftCenInd = Math.floor(cenInd / 2);
                        rightCenInd = cenInd + leftCenInd;

                        xaxisData = xaxisData.filter((value, index) =>
                            index == 0 ||
                            index == cenInd ||
                            index == leftCenInd ||
                            index == rightCenInd ||
                            index == xaxisData.length-1
                        );
                    }

                    // 稼働状況の設定情報を取得、msgへ格納
                    msg.statusObject = statusObject;

                    // 入力値がデータ取得V2(chart用) かつ データが降順だったらデータの前後をひっくり返す
                    if (confsel == "inchartSet" && sort == "false") {
                        graphData = graphData.reverse();
                        xaxisData = xaxisData.reverse();
                    }


                    // 作成したデータをmsg.payloadへ格納
                    msg.graphData = graphData;
                    msg.xaxisData = xaxisData;

                    // payloadデータを削除
                    msg.payload = [];

                    // statusObject.lengthが1以上の場合は表示処理完了
                    if (statusObject.length > 0) {
                        node.status({ fill: "green", shape: "dot", text: "runtime.complete" });
                    }
                } catch (e) {
                    node.error("oprstatus：表示対象データがありません。");
                    console.log(e)
                    node.status({ fill: "yellow", shape: "ring", text: "runtime.noData" });
                }

                // store the latest value in our Node-RED datastore
                base.stores.data.save(base, node, msg)
                // send it to any connected nodes in Node-RED
                send(msg)
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

    RED.nodes.registerType('ui-oprstatus-2', UIOprStatusNode)
}
