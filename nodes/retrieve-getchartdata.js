
module.exports = function (RED) {

	const MAX_LIMIT = 10000;			// 最大取得件数

	/* 使用モジュール定義 */
	var retrieve = require("../dynamodbConnection/retrieve")(RED);
	var moment = require("moment");

	const {iaCloudConnection} = require("@ia-cloud/node-red-contrib-ia-cloud-common-nodes");
	const CNCT_RETRY_INIT = 1 * 60 * 1000;      //リトライ間隔の初期値1分

	let cnctRtryId;     // connect retry timer ID
	let cnctRtryFlag = true;
	let tappTimerId;    // tapping CCS (getStatus()) interval timer ID

	// ダミーデータ
	let dummy;

	// 接続情報を保持するオブジェクト
	let info;

	function retrievegetchartdataNode(config) {

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

		console.log(config);

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

		console.log(info);

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
		this.objectKey = config.objectKey;					// objectKey

		this.output = config.output							// 出力形式


		if (config.output == "1") {
			dummy = [
				{
					"series": [
						""
					],
					"data": [
						[
						]
					],
					"labels": [
						""
					]
				}
			]
		} else if (config.output == "2") {
			dummy = []
		};


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

		// 出力データ項目設定情報取得
		var params;
		try {
			// params = JSON.parse(config.params);
			if (config.params != undefined) {
				params = config.params;
			} else {
				params = [];
			}
		} catch (e) {
			params = [];
		}

		var outSeriesList = [];
		params.forEach(function (object) {
			outSeriesList.push(object.dataName);
		});
		var resultList = [];		// 取得結果を保存

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
					// res = await iaC.connect();
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

		// no rule found
		if (params.length === 0) {
			node.status({ fill: "yellow", shape: "ring", text: "runtime.noParam" });
			node.sendMsg(dummy);
		} else {
			node.status({});
		}

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
			node.sdatetime = sdatetime;
			node.edatetime = edatetime;

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
				node.error("retrieve-getchartdata - 期間指定に誤りがあります");
				node.sendMsg(dummy);
			}
		}


		async function iaCloudRetrieveArrayRequest(req) {
			return new Promise(async (resolve, reject) => {
				try {
					console.log(req);
					resolve(await iaC.retrieveArray(req));
				}
				catch (e) {
					console.log(e);
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

				let tmpObj = {};
				let tmpLst = [];

				if (items != undefined && items.length > 0) {
					try {
						var itemList;						// 出力データ一時保存
						var contentList = [];				//  出力データ項目部分作成

						let v2OutSeriesList = [];

						if (config.output == "1") {
							tmpObj.series = [];                   // 出力データ：項目部分
							tmpObj.data = [];                     // 出力データ：データ部分
							tmpObj.labels = [""];          		// 出力データ：ラベル部分
						}

						// アグリゲーション処理あり
						if (node.aggregationCheck == true && items != undefined) {

							// アグリゲーションデータ
							resultList = retrieve.aggregation(items, node);

							// 桁数変更処理
							if (node.decimalPoint != "noexe") {
								resultList = retrieve.round(resultList, node);
							}

							itemList = resultList;
							delete items;
							var noDataNameFlag = false;
							var seriesList = [];



							for (var itemIdx = 0; itemIdx < itemList.length; itemIdx++) {
								// 変換データ取得
								try {
									contentList = itemList[itemIdx].contentData;
								} catch (e) {
									node.error("retrieve-getchartdata：変換対象データがありません。");
								}

								for (i = 0; i < contentList.length; i++) {
									if (contentList[i].dataName != undefined && seriesList.indexOf(contentList[i].dataName) < 0) {
										// 現在見ているデータにdataNameがある かつ seriesListに今回のdataNameがまだ格納されていない場合、seriesListに格納
										seriesList.push(contentList[i].dataName);
									} else if (contentList[i].dataname != undefined && seriesList.indexOf(contentList[i].dataname) < 0) {
										// 現在見ているデータにdatanameがある かつ seriesListに今回のdatanameがまだ格納されていない場合、seriesListに格納
										seriesList.push(contentList[i].dataname);
									} else if (contentList[i].dataName != undefined && contentList[i].dataname != undefined) {
										noDataNameFlag = true;
									}
								}
							}

							if (noDataNameFlag) {
								node.error("retrieve-getchartdata：dataNameが存在しない項目がありました");
							}

							var seriesCombList = [];
							var combIndex = -1;

							// 出力項目チェック
							for (i = 0; i < outSeriesList.length; i++) {
								combIndex = seriesList.indexOf(outSeriesList[i]);
								if (combIndex >= 0) {
									// 存在する場合表示項目に追加
									var combTmp = {
										"index": combIndex,
										"dataName": outSeriesList[i]
									};

									var matchData = params.filter(function (item, index) {
										if (item.dataName == outSeriesList[i]) return true;
									});
									if (config.output == "1") {
										if (matchData.length > 0 && matchData[0].displayName != "") {
											tmpObj.series.push(matchData[0].displayName);
										} else {
											tmpObj.series.push(outSeriesList[i]);
										}
									} else if (config.output == "2") {
										if (matchData.length > 0 && matchData[0].displayName != "") {
											v2OutSeriesList.push(matchData[0].displayName);
										} else {
											v2OutSeriesList.push(outSeriesList[i]);
										}
									}

									seriesCombList.push(combTmp);
								}
							}

							// 出力データ：データ部分作成
							for (i = 0; i < seriesCombList.length; i++) {    // 表示対象データでループ
								var dataTmp = [];
								for (j = 0; j < itemList.length; j++) {  //データ件数でループ
									var timestamp;

									// timeStamp(timestamp)を格納
									if (itemList[j].timeStamp != undefined) {
										timestamp = itemList[j].timeStamp;
									} else if (itemList[j].timestamp != undefined) {
										timestamp = itemList[j].timestamp;
									} else {
										continue;
									}

									var contentList = itemList[j].contentData;

									var matchData;
									// 格納対象のdataNameがあるデータのみをpushする
									matchData = contentList.filter(function (item, index) {
										if (item.dataName == seriesCombList[i].dataName) return true;
									});
									// datanameの可能性もあるのでマッチデータがない場合は再度フィルター
									if (matchData.length == 0) {
										matchData = contentList.filter(function (item, index) {
											if (item.dataname == seriesCombList[i].dataName) return true;
										});
									}

									if (config.output == "1") {
										if (matchData.length > 0) {
											// x:timestamp, y:dataValue
											try {
												var pushTmp = {
													"x": timestamp,
													"y": matchData[0].dataValue
												};
											} catch (e) {
												var pushTmp = {
													"x": timestamp,
													"y": null
												};
											}
											dataTmp.push(pushTmp);

										}
									}
									else if (config.output == "2") {
										if (matchData.length > 0) {
											// x:timestamp, y:dataValue
											try {
												var pushTmp = {
													"series": v2OutSeriesList[0],
													"x": timestamp,
													"y": matchData[0].dataValue
												};
											} catch (e) {
												var pushTmp = {
													"series": null,
													"x": timestamp,
													"y": null
												};
											}
											dataTmp.push(pushTmp);
										}
									}
								}
								if (config.output == "1") {
									tmpObj.data.push(dataTmp);
								} else if (config.output == "2") {
									tmpLst = dataTmp;
								}
							}

							// アグリゲーション処理なし
						} else if (node.aggregationCheck == false && items != undefined) {

							// 生データ
							resultList = tmpObj;
							resultList.Items = items;

							// 桁数変更処理
							if (node.decimalPoint != "noexe") {
								resultList = retrieve.round(resultList, node);
							}

							itemList = resultList.Items;
							delete resultList.Items;
							var noDataNameFlag = false;
							var seriesList = [];

							for (var itemIdx = 0; itemIdx < itemList.length; itemIdx++) {
								// 変換データ取得
								try {
									if (itemList[itemIdx].dataObject.objectContent != undefined) {
										contentList = itemList[itemIdx].dataObject.objectContent.contentData;
									} else if (itemList[itemIdx].dataObject.ObjectContent != undefined) {
										contentList = itemList[itemIdx].dataObject.ObjectContent.contentData;
									} else {
										continue;
									}
								} catch (e) {
									node.error("retrieve-getchartdata：変換対象データがありません。");
								}

								for (i = 0; i < contentList.length; i++) {
									if (contentList[i].dataName != undefined && seriesList.indexOf(contentList[i].dataName) < 0) {
										// 現在見ているデータにdataNameがある かつ seriesListに今回のdataNameがまだ格納されていない場合、seriesListに格納
										seriesList.push(contentList[i].dataName);
									} else if (contentList[i].dataname != undefined && seriesList.indexOf(contentList[i].dataname) < 0) {
										// 現在見ているデータにdatanameがある かつ seriesListに今回のdatanameがまだ格納されていない場合、seriesListに格納
										seriesList.push(contentList[i].dataname);
									} else if (contentList[i].dataName != undefined && contentList[i].dataname != undefined) {
										noDataNameFlag = true;
									}
								}
							}
							if (noDataNameFlag) {
								node.error("retrieve-getchartdata：dataNameが存在しない項目がありました");
							}
							var seriesCombList = [];
							var combIndex = -1;

							// 出力項目チェック
							for (i = 0; i < outSeriesList.length; i++) {
								combIndex = seriesList.indexOf(outSeriesList[i]);

								if (combIndex >= 0) {
									// 存在する場合表示項目に追加
									var combTmp = {
										"index": combIndex,
										"dataName": outSeriesList[i]
									};

									var matchData = params.filter(function (item, index) {
										if (item.dataName == outSeriesList[i]) return true;
									});
									if (config.output == "1") {
										if (matchData.length > 0 && matchData[0].displayName != "") {
											tmpObj.series.push(matchData[0].displayName);
										} else {
											tmpObj.series.push(outSeriesList[i]);
										}
									} else if (config.output == "2") {
										if (matchData.length > 0 && matchData[0].displayName != "") {
											v2OutSeriesList.push(matchData[0].displayName);
										} else {
											v2OutSeriesList.push(outSeriesList[i]);
										}
									}
									seriesCombList.push(combTmp);
								}
							}
							seriesCombList.push(combTmp);

							// 出力データ：データ部分作成
							for (i = 0; i < seriesCombList.length - 1; i++) {    // 表示対象データでループ
								var dataTmp = [];
								for (j = 0; j < itemList.length; j++) {  //データ件数でループ
									var timestamp;

									// timeStamp(timestamp)を格納
									if (itemList[j].dataObject.timeStamp != undefined) {
										timestamp = itemList[j].dataObject.timeStamp;
									} else if (itemList[j].dataObject.timestamp != undefined) {
										timestamp = itemList[j].dataObject.timestamp;
									} else {
										continue;
									}

									var contentList;
									if (itemList[j].dataObject.objectContent != undefined) {
										contentList = itemList[j].dataObject.objectContent.contentData;
									} else if (itemList[j].dataObject.ObjectContent != undefined) {
										contentList = itemList[j].dataObject.ObjectContent.contentData;
									} else {
										continue;
									}

									var matchData;
									// 格納対象のdataNameがあるデータのみをpushする
									matchData = contentList.filter(function (item, index) {
										if (item.dataName == seriesCombList[i].dataName) return true;
									});
									// datanameの可能性もあるのでマッチデータがない場合は再度フィルター
									if (matchData.length == 0) {
										matchData = contentList.filter(function (item, index) {
											if (item.dataname == seriesCombList[i].dataName) return true;
										});
									}

									if (config.output == "1") {
										if (matchData.length > 0) {
											// x:timestamp, y:dataValue
											try {
												var pushTmp = {
													"x": timestamp,
													"y": matchData[0].dataValue
												};
											} catch (e) {
												var pushTmp = {
													"x": timestamp,
													"y": null
												};
											}
											dataTmp.push(pushTmp);

										}
									}
									else if (config.output == "2") {
										console.log(j);
										if (matchData.length > 0) {
											// x:timestamp, y:dataValue
											try {
												var pushTmp = {
													"series": v2OutSeriesList[0],
													"x": timestamp,
													"y": matchData[0].dataValue
												};
											} catch (e) {
												var pushTmp = {
													"series": null,
													"x": timestamp,
													"y": null
												};
											}
											dataTmp.push(pushTmp);
										}
									}

								}

								if (config.output == "1") {
									tmpObj.data.push(dataTmp);
								} else if (config.output == "2") {
									tmpLst = dataTmp;
								}
							}
						}

						if (config.output == "1") {
							resultList = [tmpObj];
						} else if (config.output == "2") {
							resultList = tmpLst;
						}

						try {
							if (config.output == "1") {
								if (resultList[0].data.length > 0) {
									node.status({ fill: "green", shape: "dot", text: "runtime.complete" });
									node.sendMsg(resultList);
								} else {
									node.status({ fill: "yellow", shape: "ring", text: "runtime.noData" });
									node.sendMsg(dummy);
								}
							} else if (config.output == "2") {
								if (resultList.length > 0) {
									node.status({ fill: "green", shape: "dot", text: "runtime.complete" });
									node.sendMsg(resultList);
								} else {
									node.status({ fill: "yellow", shape: "ring", text: "runtime.noData" });
									node.sendMsg(dummy);
								}
							}
						} catch (e) {
							console.log(e);
							node.status({ fill: "yellow", shape: "ring", text: "runtime.noData" });
							node.sendMsg(dummy);
						}
					} catch (e) {
						// データ取得時に例外発生
						console.log(e);
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
				console.log(error);
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

	RED.nodes.registerType("retrieve-getchartdata", retrievegetchartdataNode);
};
