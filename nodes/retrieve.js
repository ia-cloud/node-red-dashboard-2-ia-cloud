
module.exports = function (RED) {

	const MAX_LIMIT = 1000;			// 最大取得件数 CCSの環境変数に合わせる

	/* 使用モジュール定義 */
	var retrieve = require("../dynamodbConnection/retrieve")(RED);
	var moment = require("moment");

	const {iaCloudConnection} = require("@ia-cloud/node-red-contrib-ia-cloud-common-nodes");
	const CNCT_RETRY_INIT = 1 * 60 * 1000;      //リトライ間隔の初期値1分

	let cnctRtryId;     // connect retry timer ID
	let cnctRtryFlag = true;
	let tappTimerId;    // tapping CCS (getStatus()) interval timer ID

	// ダミーデータ
	var dummy = { Items: [] };

	// 接続情報を保持するオブジェクト
	let info;

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

		info = {
			status: "Disconnected",
			serviceID: "",
			version: ccsConnectionConfigNode.version,
			url: url,
			userID: ccsConnectionConfigNode.credentials.userId,
			Authorization: "Basic " + Buffer.from(username + ":" + password).toString("base64"),
			FDSKey: String(config.fdskey),
			FDSType: "iaCloudFDS",
			cnctTs: "",
			lastReqTs: "",
			comment: String(config.comment),
			cnctRetryInterval: config.cnctRetryInterval * 60 * 1000,
			tappingInterval: config.tappingInterval * 60 * 60 * 1000,

			proxy: ccsConnectionConfigNode.proxy,
			reqTimeout: 12000
		};

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

		const iaC = new iaCloudConnection(fContext, cnctInfoName, auth);

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
			// 上限件数の指定がない or MAX_LIMITを超える値の場合はMAX_LIMIT件とする
			this.limit = MAX_LIMIT;
		}

		let retrieveArrayLimit = parseInt(this.limit);

		// 繰り返し条件の取得
		this.repeatCheck = config.repeatCheck;
		this.repeat = config.repeat;
		var interval = null;

		var resultList;										// 取得結果格納用配列

		// connect リクエスト
		//connect request を送出（接続状態にないときは最大cnctRetryIntervalで繰り返し）

		let rInt = CNCT_RETRY_INIT;   //リトライ間隔の初期値
		// connectリクエストのトライループ
		(async function cnctTry() {

			//非接続状態なら接続トライ
			if (info.status === "Disconnected") {

				// node status をconnecting に
				node.status({ fill: "blue", shape: "dot", text: "runtime.connecting" });

				// nodeの出力メッセージ（CCS接続状態）
				let msg = {};
				let res;

				// connect リクエスト
				try {
					res = await iaC.connect(auth);
					node.status({ fill: "green", shape: "dot", text: "runtime.connected" });

				} catch (error) {
					node.status({ fill: "yellow", shape: "ring", text: error.message });
					res = error.message;

					//retryの設定。倍々で間隔を伸ばし最大はcnctRetryInterval、
					if (info.cnctRetryInterval !== 0) {
						rInt *= 2;
						rInt = (rInt < info.cnctRetryInterval) ? rInt : info.cnctRetryInterval;
					}
				} finally {
					console.log(info);
					return res;
				}

			} else {
				rInt = CNCT_RETRY_INIT;
			}
			// connect retry loop
			if (info.cnctRetryInterval !== 0 && cnctRtryFlag)
				cnctRtryId = setTimeout(cnctTry, rInt);

		}())

		if (node.repeatCheck) {
			tappTimerId = setInterval(function () {

				//非接続状態の時は、何もしない。
				if (info.status === "Disconnected") return;

				// node status をconnecting に
				node.status({ fill: "blue", shape: "dot", text: "runtime.connecting" });
				info.status = "requesting";
				let msg = {};
				(async () => {
					// getStatus リクエスト
					try {
						let res = await iaC.getStatus();
						node.status({ fill: "green", shape: "dot", text: "runtime.connected" });
						msg.payload = res;
					} catch (error) {
						node.status({ fill: "yellow", shape: "ring", text: error.message });
						msg.payload = error.message;
					} finally {
						node.send(msg);
					}
				})();
			}, info.tappingInterval);
		}


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

			// sdatetime, edatetime共に入力あり かつ sdatetime<=edatetimeの場合に処理続行
			if (sdatetime == undefined || edatetime == undefined || moment(sdatetime) <= moment(edatetime)) {

				let query = {
					limit: limit,	// 検索上限
					type: "between",    // 検索方法
					from: "",
					to: "",
				}

				if (sdatetime != undefined) {
					query.from = moment(sdatetime).format("YYYY-MM-DDTHH:mm:ss");
				}
				if (edatetime != undefined) {
					query.to = moment(edatetime).format("YYYY-MM-DDTHH:mm:ss");
				}

				if (node.sdatetime != undefined && node.edatetime != undefined) {
					// 開始・終了共に条件あり
					query.from = sdatetime + "+09:00";	        // 期間セット
					query.to = edatetime + "+09:00";	        // 期間セット
				} else if (node.sdatetime != undefined && node.edatetime == undefined) {
					// 開始のみ条件あり
					query.from = node.query.from + "+09:00";		        // 期間セット
					delete node.query.to;                                    // 期間セット
				} else if (node.sdatetime == undefined && node.edate != undefined) {
					// 終了のみ条件あり
					delete query.from;                                    // 期間セット
					query.to = edatetime + "+09:00";          // 期間セット
				} else {
					// 開始・終了共に条件なし
					delete query.from;                                    // 期間セット
					delete query.to;                                   // 期間セット
				}

				let req = {
					"objectKey": objectKey,
					"query": query
				}

				// retrieveArray リクエスト
				iaCloudRetrieveArrayRequest(req);
			} else {
				node.status({ fill: "red", shape: "ring", text: "runtime.periodError" });
				node.error("retrieve - 期間指定に誤りがあります");
				node.sendMsg(dummy);
			}
		}

		// retrieveArray リクエスト
		async function iaCloudRetrieveArrayRequest(req) {
			return new Promise(async (resolve, reject) => {
				try {
					resolve(await iaC.retrieveArray(req));
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


	RED.nodes.registerType("retrieve", retrieveNode);
};
