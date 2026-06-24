
module.exports = function (RED) {

	// time interval for the connection status check
	const STATUSINTERVAL = 10 * 1000;

	function retrievegetlatestdataNode(config) {

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
		this.operation = "Query";							// 処理名

		this.TableName = config.tableName;					// 検索対象テーブル名
		this.Limit = 1;										// 検索件数
		this.ScanIndexForward = "false";					// 並び順

		this.decimalPoint = config.decimalPoint;			// 表示桁数
		this.KeyConditionExpression = "objectKey = :a";		// 検索条件
		this.objectKey = config.objectKey;

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
			outSeriesList.push(object);
		});

		this.item = config.item;						// 出力データの構成設定

		let statusTimerId = setInterval(function(){
            if (info.status === "Disconnected")
                node.status({fill:"blue", shape:"dot", text:"runtime.disconnected"});
            else if (info.status === "Connected")
                node.status({fill:"green", shape:"dot", text:"runtime.connected"});
        }, STATUSINTERVAL) ;

		// sendメッセージ関数作成
		node.sendMsg = function (data, label) {
			var msg;
			if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
				node.status({ fill: "red", shape: "ring", text: "runtime.error" });
				node.error("error: sendMeg error");
				return;
			} else {
				msg = { payload: data };
				if (label !== undefined && label !== null && label !== "") {
					msg.ui_update = {
						label: label
					};
				}
			}
			node.send(msg);
		};

		// no rule found
		if (params.length === 0) {
			node.status({ fill: "yellow", shape: "ring", text: "runtime.noParam" });
			node.sendMsg([]);
		} else {
			node.status({});
		}

		// 繰り返し設定がされている場合は指定間隔で処理を繰り返す
		if (node.repeatCheck) {
			interval = setInterval(function () {
				if (params.length > 0) {
					dataGet(config.objectKey);
				}
			}, node.repeat * 1000);
		}

		// injectされたら実行
		node.on('input', function () {
			if (params.length > 0 && info.status === "Connected") {
				dataGet(config.objectKey);
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
		function dataGet(objectKey) {
			node.status({ fill: "blue", shape: "dot", text: "runtime.connect" });

			let query = {
				limit: 1,	// 検索上限
				type: "between",    // 検索方法
			}

			let req = {
				"objectKey": objectKey,
				"query": query
			}

			// retrieveArray リクエスト
			iaCloudRetrieveArrayRequest(req);
		}

		// retrieveArray リクエスト
		async function iaCloudRetrieveArrayRequest(req) {
			return new Promise(async (resolve, reject) => {
				try {
					resolve(await ccsConnectionConfigNode.iaCloudCommand("retrieveArray", req))
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

			var i, j;
			let outputLabel = null;

			try {
				// 正常なレスポンス
				var items = data;
				if (items != undefined && items.length > 0) {
					try {
						var itemList;						// 出力データ一時保存
						var contentList;					// contentData一時格納用
						resultList = {
							Items: [data[0]]
						};					// 結果出力配列に一時的にresultを入力
						// 桁数変更処理
						if (node.decimalPoint != "noexe") {
							resultList = dynamodb.round(resultList, node);
						}

						itemList = resultList.Items;
						let originalItem = itemList[0];
						delete resultList.Items;
						resultList = [];

						// 出力データ：項目部分抽出
						if (itemList[0].dataObject.objectContent != undefined) {
							contentList = itemList[0].dataObject.objectContent.contentData;
						} else if (itemList[0].dataObject.ObjectContent != undefined) {
							contentList = itemList[0].dataObject.ObjectContent.contentData;
						} else {
							console.log("objectContent(ObjectContent)が無効\n");
						}
						if (contentList != undefined && node.item == "graphData") {
							// 単一値

							for (i = 0; i < outSeriesList.length; i++) {
								for (j = 0; j < contentList.length; j++) {
									if (outSeriesList[i].dataName == contentList[j].dataName) {
										break;
									} else if (outSeriesList[i].dataName == contentList[j].dataname) {
										break;
									}
								}
								if (j < contentList.length) {
									// 見つかった場合
									resultList = Number(contentList[j].dataValue);
								} else {
									// 見つからなかった場合
									resultList = null;
								}

								if (outSeriesList[i].displayName != undefined && outSeriesList[i].displayName !== "") {
									outputLabel = outSeriesList[i].displayName;
								} else {
									outputLabel = outSeriesList[i].dataName;
								}

								node.status({ fill: "green", shape: "dot", text: "runtime.complete" });
							}
						} else if (contentList != undefined && node.item == "numericData") {
							// 二次元配列
							var tempAry;							// 一時保存用配列

							for (i = 0; i < outSeriesList.length; i++) {
								for (j = 0; j < contentList.length; j++) {
									if (outSeriesList[i].dataName == contentList[j].dataName) {
										break;
									} else if (outSeriesList[i].dataName == contentList[j].dataname) {
										break;
									}
								}
								if (j < contentList.length) {
									// 見つかった場合
									tempAry = [];

									// 表示名が設定されている場合は表示名をtempAryへ格納
									if (outSeriesList[i].displayName != "") {
										tempAry.push(outSeriesList[i].displayName);
									} else {
										tempAry.push(outSeriesList[i].dataName);
									}

									// dataValueをtempAryへ格納
									if (contentList[j].dataValue != undefined) {
										tempAry.push(contentList[j].dataValue);
									} else {
										tempAry.push(null);
									}

									// 単位をtempAryへ格納
									if (contentList[j].unit != undefined) {
										tempAry.push(contentList[j].unit);
									} else {
										tempAry.push(null);
									}
									resultList.push(tempAry);
								} else {
									// 見つからなかった場合
									tempAry = [null, null, null];
									resultList.push(tempAry);
								}
							}
							node.status({ fill: "green", shape: "dot", text: "runtime.complete" });
						} else if (contentList != undefined && node.item == "iaCloudData") {
							// ia-cloudオブジェクト形式での出力
							let filteredContent = [];

							for (i = 0; i < outSeriesList.length; i++) {
								for (j = 0; j < contentList.length; j++) {
									if (outSeriesList[i].dataName == contentList[j].dataName ||
										outSeriesList[i].dataName == contentList[j].dataname) {

										filteredContent.push(contentList[j]);
										break;
									}
								}
							}

							// 元データをコピーして差し替え
							let newItem = JSON.parse(JSON.stringify(originalItem));

							newItem.dataObject.objectContent.contentData = filteredContent;

							resultList = newItem.dataObject;
							outputLabel = null;

							node.status({ fill: "green", shape: "dot", text: "runtime.complete" });
						} else {
							node.error("getLatestdata - 指定条件のデータが見つかりませんでした");
							node.status({ fill: "red", shape: "ring", text: "runtime.faild" });
							resultList = [];
						}
						node.sendMsg(resultList, outputLabel);
					} catch (e) {
						// データ取得時に例外発生
						console.log("データ分解時に例外発生", e);
						node.status({ fill: "red", shape: "ring", text: "runtime.faild" });
						node.sendMsg([]);
					}
				} else if (items != undefined && items.length > -1) {
					node.status({ fill: "yellow", shape: "ring", text: "runtime.noData" });
					node.sendMsg([]);
				} else {
					node.status({ fill: "red", shape: "ring", text: "runtime.faild" });
					node.sendMsg([]);
				}

			} catch (error) {
				// 異常なレスポンス
				node.status({ fill: "red", shape: "ring", text: "runtime.faild" + error });
				node.sendMsg(dummy);
			} finally {
				return res;
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
	}
	RED.nodes.registerType("retrieve-getlatestdataII", retrievegetlatestdataNode);
};
