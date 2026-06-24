
module.exports = function (RED) {

	const MAX_LIMIT = 1000;			// 最大取得件数 CCSの環境変数に合わせる
	const DEFAULT_NUM = 1000;

	/* 使用モジュール定義 */
	var retrieve = require("../dynamodbConnection/retrieve")(RED);
	var moment = require("moment");

	// ダミーデータ
	var dummy = { Items: [] };

	// time interval for the connection status check
	const STATUSINTERVAL = 10 * 1000;

	function retrieveNode(config) {

		RED.nodes.createNode(this, config);

		var node = this;

		node.status({ fill: "yellow", shape: "ring", text: "runtime.wait" });

		// CCS接続用情報の取得
		// ia-cloud connection config node instance
		const ccsConnectionConfigNode = RED.nodes.getNode(config.ccsConnectionConfig);

		// ia-cloud connection config node instance
		// ia-cloud v2 接続設定
		let username = String(ccsConnectionConfigNode.credentials.userId);
		let password = String(ccsConnectionConfigNode.credentials.password);
		let url = String(ccsConnectionConfigNode.url);

		let auth = {
			username: username,
			password: password,
		};

		// get the connection information
        let gContext = this.context().global;
        let info = gContext.get(ccsConnectionConfigNode.cnctInfoName);

		// environmental proxy setting
        if (!info.proxy) {
            let prox;
            let noprox;
            if (process.env.http_proxy != null) { prox = process.env.http_proxy; }
            if (process.env.HTTP_PROXY != null) { prox = process.env.HTTP_PROXY; }
            if (process.env.no_proxy != null) { noprox = process.env.no_proxy.split(","); }
            if (process.env.NO_PROXY != null) { noprox = process.env.NO_PROXY.split(","); }
            info.proxy = "";
            if (noprox) {
                for (let i in noprox) {
                    if (info.url.indexOf(noprox[i]) === -1) { info.proxy = prox; }
                }
            }
        }

		// proxy server address check
		if (info.proxy) {
			let match = prox.match(/^(http:\/\/)?(.+)?:([0-9]+)?/i);
			if (!match) {
				node.warn("Bad proxy url: " + prox);
				info.proxy = "";
			}
		}

		// set ia-cloud api protocol
        if (!info.version || info.version === "V1") info.protocol = "REST1";
        else if (info.version === "V2") {
            const url = new URL(info.url);
            if (url.protocol === "https:") info.protocol = "REST2";
            else if (url.protocol === "wss:" || url.protocol === "ws:") info.protocol = "websocket";
            else {throw new IaCloudInvalidProtocol();}
        }
        else {throw new IaCloudInvalidProtocol();}

		// このタイムアウトの設定の詳細を調査する必要あり
		if (RED.settings.httpRequestTimeout) {
			info.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000;
		}
		else { info.reqTimeout = 120000; }

		let cnctInfoName = "ia-cloud-connection-" + info.FDSKey.replace(/\s+/g, "_");
		let fContext = this.context().flow;
		fContext.set(cnctInfoName, info);

		// 検索条件の取得
		this.name = config.name;							// ノード名
		this.operation = config.operation;					// 処理名

		this.TableName = config.tableName;					// 検索対象テーブル名
		this.limit = config.limit;							// 検索件数
		this.ScanIndexForward = config.sort;				// 並び順

		this.dateCheck = config.dateCheck;					// 期間設定方法
		// this.sdatetime = config.sdatetime;					// 期間 開始期間
		// this.edatetime = config.edatetime;					// 期間 終了期間

		this.aggregationCheck = config.aggregationCheck;	// アグリゲーション設定の有無
		this.aggregation = config.aggregation;				// アグリゲーション操作
		this.aggreunit = config.aggreunit;					// アグリゲーション単位
		this.decimalPoint = config.decimalPoint;			// 表示桁数
		this.objectKey = config.objectKey;

		// Limitチェック
		if (this.limit == "" || this.limit > MAX_LIMIT) {
			// 上限件数の指定がない or MAX_LIMITを超える値の場合はDEFAULT_NUM件とする
			this.limit = DEFAULT_NUM;
		}

		let retrieveArrayLimit = parseInt(this.limit);

		// 繰り返し条件の取得
		this.repeatCheck = config.repeatCheck;
		this.repeat = config.repeat;
		var interval = null;

		var resultList;										// 取得結果格納用配列

		let statusTimerId = setInterval(function(){
            if (info.status === "Disconnected")
                node.status({fill:"blue", shape:"dot", text:"runtime.disconnected"});
            else if (info.status === "Connected")
                node.status({fill:"green", shape:"dot", text:"runtime.connected"});
        }, STATUSINTERVAL) ;

		// sendメッセージ関数作成
		node.sendMsg = function (data) {
			var msg;
			if (data == []) {
				node.status({ fill: "red", shape: "ring", text: "runtime.error" });
				node.error("error: sendMeg error");
				return;
			} else {
				msg = { payload: data };
			}
			node.send(msg);
		};

		// 繰り返し設定がされている場合は指定間隔で処理を繰り返す
		if (node.repeatCheck) {
			interval = setInterval(function () {
				dataGet(config.objectKey, config.sdatetime, config.edatetime, retrieveArrayLimit);
			}, node.repeat * 1000);
		}

		// injectされたら実行
		node.on('input', function (msg) {
			if (node.dateCheck == "inDateset" && info.status === "Connected") {
				dataGet(config.objectKey, msg.payload.sdatetime, msg.payload.edatetime, retrieveArrayLimit);
			} else if (node.dateCheck == "inNodeSetting" && info.status === "Connected") {
				dataGet(config.objectKey, config.sdatetime, config.edatetime, retrieveArrayLimit);
			} else {
				node.status({ fill: "yellow", shape: "ring", text: "runtime.wait" });
			}
		});

		// 処理終了時にはintervalをクリアする
		this.on('close', function () {
			if (statusTimerId != null) {
				clearInterval(statusTimerId);
			}
			if (interval != null) {
				clearInterval(interval);
			}
			if (node.done) {
				node.status({});
				node.done();
			}
		});

		// データ取得処理
		function dataGet(objectKey, sdatetime, edatetime, limit) {


			node.status({ fill: "blue", shape: "dot", text: "runtime.connect" });

			if (sdatetime == null || sdatetime == "") {
				sdatetime = undefined
			}
			if (edatetime == null || edatetime == "") {
				edatetime = undefined
			}
			node.sdatetime = sdatetime;
			node.edatetime = edatetime;

			// sdatetime, edatetimeともに入力あり かつ sdatetime>edatetimeの場合
			if (sdatetime != undefined && edatetime != undefined && moment(sdatetime) > moment(edatetime)) {
				node.status({ fill: "red", shape: "ring", text: "runtime.periodError" });
				node.error("retrieve - 期間指定に誤りがあります");
				node.sendMsg(dummy);
			} else {
				// そのほか取得処理

				let query = {
					limit: limit,	// 検索上限
					type: "between",    // 検索方法
					from: "",
					to: "",
				}

				// 並び替え
				if (node.ScanIndexForward == "true") {
					query.ScanIndexForward = true;
				} else if (node.ScanIndexForward == "false") {
					query.ScanIndexForward = false;
				}

				if (sdatetime != undefined) {
					query.from = moment(sdatetime).format("YYYY-MM-DDTHH:mm:ss");
				}
				if (edatetime != undefined) {
					query.to = moment(edatetime).format("YYYY-MM-DDTHH:mm:ss");
				}

				if (sdatetime != undefined && edatetime != undefined) {
					// 開始・終了共に条件あり
					query.from = sdatetime + "+09:00";					// 期間セット
					query.to = edatetime + "+09:00";					// 期間セット
				} else if (sdatetime != undefined && edatetime == undefined) {
					// 開始のみ条件あり
					query.from = sdatetime + "+09:00";					// 期間セット
					delete query.to;									// 期間セット
					query.ScanIndexForward = true;						// 昇順に設定
				} else if (sdatetime == undefined && edatetime != undefined) {
					// 終了のみ条件あり
					delete query.from;									// 期間セット
					query.to = edatetime + "+09:00";					// 期間セット
					query.ScanIndexForward = false;						// 降順に設定
				} else {
					// 開始・終了共に条件なし
					delete query.from;									// 期間セット
					delete query.to;									// 期間セット
					query.ScanIndexForward = false;						// 降順に設定
				}

				let req = {
					"objectKey": objectKey,
					"query": query
				}

				// retrieveArray リクエスト
				iaCloudRetrieveArrayRequest(req);
			}
		}

		// retrieveArray リクエスト
		async function iaCloudRetrieveArrayRequest(req) {
			return new Promise(async (resolve, reject) => {
				try {
					resolve(await ccsConnectionConfigNode.iaCloudCommand("retrieveArray", req));
				}
				catch (e) {
					reject(e);
				}
			})
				.then((res) => {
					// レスポンス変換
					return convertToSingleObj(res.dataObjectArray.objectArray)
				})
				.then((data) => {
					dataEdit(data);
				})
				.catch((err) => {
					node.status({ fill: "yellow", shape: "ring", text: err.message });
				})
		}

		// データ加工
		function dataEdit(data) {
			// ノードのレスポンス
			let res;

			try {
				// 正常なレスポンス
				var items = data;
				if (items != undefined && items.length > 0) {
					try {
						// アグリゲーション処理
						if (node.aggregationCheck) {
							resultList = retrieve.aggregation(items, node);
						} else {
							resultList = items;
						}

						// 期間未設定時、並び替え
						if (node.sdatetime == undefined && node.edatetime == undefined) {
							if (node.ScanIndexForward == "true") {
								resultList.reverse();
							}
						// 開始のみ設定時、並び替え
						} else if (node.sdatetime != undefined && node.edatetime == undefined) {
							if (node.ScanIndexForward == "false") {
								resultList.reverse();
							}
						// 終了のみ設定時、並び替え
						} else if (node.sdatetime == undefined && node.edatetime != undefined) {
							if (node.ScanIndexForward == "true") {
								resultList.reverse();
							}
						}

						// 桁数変更処理
						if (node.decimalPoint != "noexe") {
							resultList = retrieve.round(resultList, node);
						}
						node.status({ fill: "green", shape: "dot", text: "runtime.complete" });
						// Itemsで囲ってから送信
						node.sendMsg({ "Items": resultList });
						// node.sendMsg(resultList);
					} catch (e) {
						// データ取得時に例外発生
						node.status({ fill: "red", shape: "ring", text: "runtime.faild" });
						node.sendMsg(dummy);
					}
				} else if (items != undefined && items.length > -1) {
					node.status({ fill: "yellow", shape: "ring", text: "runtime.noData" });
					node.sendMsg(dummy);
				} else {
					node.status({ fill: "red", shape: "ring", text: "runtime.faild" });
					node.sendMsg(dummy);
				}
			} catch (error) {
				// 異常なレスポンス
				node.status({ fill: "red", shape: "ring", text: "runtime.faild" });
				node.sendMsg(dummy);
			} finally {
				return res;
			}
		}
	}

	// dataObjectArrayからiaCloudObjectのリストに変換する
	function convertToSingleObj(objAry) {
		// 各オブジェクトを格納する配列
		let items = [];

		// 処理対象データの有無を確認
		if (objAry.length > 0) {
			objAry.forEach(function (elment, index) {
				items[index] = {
					"objectKey": elment.objectKey,
					"dataObject": elment,
					"timestamp": elment.timestamp
				};
			});
		}

		return items;
	}


	RED.nodes.registerType("retrieveII", retrieveNode);
};
