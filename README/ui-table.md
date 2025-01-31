# node-red-dashboard-2-ui-table

## 名称

dashboard-2 - ui-tableノード

## 機能概要

ウィジェット追加方法[[Building Third Party Widgets](https://dashboard.flowfuse.com/contributing/widgets/third-party.html)]を参考に実装したノードです。
テーブルを表示します。

## 入力メッセージ

このノードを利用する際には、ノード前にクエリを作成し
プロパティ内で入力値に設定したものに対応した入力パラメータを入力します。
「ノード：[retrieve](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/retrieve.md)」と「ノード：[retrieve-getchartdata](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/retrieve-getchartdata.md)」からの出力を直接本ノードに入力して使用することも可能です。

- ### retrieve

  retrieve からの出力を入力する場合は、入力値で「retrieve」を指定します。
  以下に例を示します。

          {
            "Items": [
              {
                "objectKey": "HandsonUser0.AnETest",
                "dataObject": {
                  "timeStamp": "2019-11-17T15:28:33+09:00",
                  "ObjectContent": {
                    "contentType": "Alarm&Event",
                    "contentData": [
                      {
                        "dataValue": {
                          "AnEStatus": "set",
                          "AnEDescription": "S103のセンサ異常が発生しました。",
                          "AnECode": "S103"
                        },
                        "commonName": "Alarm&Event"
                      },
                      {
                        "dataValue": {
                          "AnEStatus": "off",
                          "AnEDescription": "ゾーン1での温度上昇異常",
                          "AnECode": "ZT01"
                        },
                        "commonName": "Alarm&Event"
                      }
                    ]
                  },
                  "objectKey": "HandsonUser0.AnETest",
                  "objectType": "iaCloudObject",
                  "objectDescription": "HandsonUser0アラームイベントデータのテストデータ"
                },
                "timestamp": "2019-11-17T15:28:33+09:00"
              },
              {
                "objectKey": "HandsonUser0.AnETest",
                "dataObject": {
                  "timeStamp": "2019-11-17T15:32:23+09:00",
                  "ObjectContent": {
                    "contentType": "Alarm&Event",
                    "contentData": [
                      {
                        "dataValue": {
                          "AnEStatus": "reset",
                          "AnEDescription": "S103のセンサ異常が発生しました。",
                          "AnECode": "S103"
                        },
                        "commonName": "Alarm&Event"
                      },
                      {
                        "dataValue": {
                          "AnEStatus": "off",
                          "AnEDescription": "ゾーン1での温度上昇異常",
                          "AnECode": "ZT01"
                        },
                        "commonName": "Alarm&Event"
                      }
                    ]
                  },
                  "objectKey": "HandsonUser0.AnETest",
                  "objectType": "iaCloudObject",
                  "objectDescription": "HandsonUser0アラームイベントデータのテストデータ"
                },
                "timestamp": "2019-11-17T15:32:23+09:00"
              },
              {
                "objectKey": "HandsonUser0.AnETest",
                "dataObject": {
                  "timeStamp": "2019-11-17T15:40:54+09:00",
                  "ObjectContent": {
                    "contentType": "Alarm&Event",
                    "contentData": [
                      {
                        "dataValue": {
                          "AnEStatus": "off",
                          "AnEDescription": "S103のセンサ異常が発生しました。",
                          "AnECode": "S103"
                        },
                        "commonName": "Alarm&Event"
                      },
                      {
                        "dataValue": {
                          "AnEStatus": "set",
                          "AnEDescription": "ゾーン1での温度上昇異常",
                          "AnECode": "ZT01"
                        },
                        "commonName": "Alarm&Event"
                      }
                    ]
                  },
                  "objectKey": "HandsonUser0.AnETest",
                  "objectType": "iaCloudObject",
                  "objectDescription": "HandsonUser0アラームイベントデータのテストデータ"
                },
                "timestamp": "2019-11-17T15:40:54+09:00"
              },
              {
                "objectKey": "HandsonUser0.AnETest",
                "dataObject": {
                    "timeStamp": "2019-11-17T15:46:45+09:00",
                    "ObjectContent": {
                      "contentType": "Alarm&Event",
                      "contentData": [
                        {
                          "dataValue": {
                            "AnEStatus": "set",
                            "AnEDescription": "S103のセンサ異常が発生しました。",
                            "AnECode": "S103"
                          },
                          "commonName": "Alarm&Event"
                        },
                        {
                          "dataValue": {
                            "AnEStatus": "on",
                            "AnEDescription": "ゾーン1での温度上昇異常",
                            "AnECode": "ZT01"
                          },
                          "commonName": "Alarm&Event"
                        }
                      ]
                    },
                    "objectKey": "HandsonUser0.AnETest",
                    "objectType": "iaCloudObject",
                    "objectDescription": "HandsonUser0アラームイベントデータのテストデータ"
                },
                "timestamp": "2019-11-17T15:46:45+09:00"
              }
            ]
          }

- ### retrieve-getchartdata

  retrieve-getchartdata(出力形式=「Node-RED Dashboard2.0」) からの出力を入力する場合は、入力値で「retrieve-getchartdata」を指定します。
  以下に例を示します。

        [
          {
            "series": "CPU温度",
            "x": "2017-10-16T08:18:12.477214+09:00",
            "y": 35.938
          },
          {
            "series": "CPU温度",
            "x": "2017-10-16T08:17:42.476071+09:00",
            "y": 35.938
          },
          {
            "series": "CPU温度",
            "x": "2017-10-16T08:17:12.476207+09:00",
            "y": 35.399
          },
          {
            "series": "CPU使用率",
            "x": "2017-10-16T08:18:12.477214+09:00",
            "y": 0
          },
          {
            "series": "CPU使用率",
            "x": "2017-10-16T08:17:42.476071+09:00",
            "y": 0
          },
          {
            "series": "CPU使用率",
            "x": "2017-10-16T08:17:12.476207+09:00",
            "y": 0
          },
          {
            "series": "空きメモリ量",
            "x": "2017-10-16T08:18:12.477214+09:00",
            "y": 500.3
          },
          {
            "series": "空きメモリ量",
            "x": "2017-10-16T08:17:42.476071+09:00",
            "y": 499.92
          },
          {
            "series": "空きメモリ量",
            "x": "2017-10-16T08:17:12.476207+09:00",
            "y": 500.092
          }
        ]

- ### フォーマットデータ

  直接変換対象データを入力する場合は、入力値で「フォーマットデータ」を指定し、項目名を入力します。
  以下に例を示します。

          [
            ["2017-10-16T08:18:12.477214+09:00",35.938,0],
            ["2017-10-16T08:17:42.476071+09:00",35.938,0],
            ["2017-10-16T08:17:12.476207+09:00",35.399,0],
            ["2017-10-16T08:16:42.476268+09:00",36.476,0],
            ["2017-10-16T08:16:12.485345+09:00",35.399,0]
          ]

## プロパティ

変換するデータに応じて、以下のパラメータを設定します。

- ### グループ

  結果を出力するダッシュボードグループを設定します。

- ### サイズ

  結果出力時のテーブルサイズを設定します。

- ### ラベル

  ダッシュボード上での表示名を設定します。

- ### 入力値

  入力するデータの種類を設定します。
  　・retrieve
  　・retrieve-getchartdata
  　・フォーマットデータ

- ### 集計データタイプ

  入力データによって扱うことができる ia-cloud オブジェクトが異なります。
  今回入力する ia-cloud オブジェクトのタイプを設定します。

- ### 表示ステータス

  入力値にretrieveを指定した場合、表示するステータスを設定します。

- ### 項目名

  入力値にフォーマットデータを指定した場合、テーブル上部に表示する項目名を設定します。
  例：列名 A,列名 B,列名 C

- ### 名前

  フロー上で表示するノード名を設定します。

## 出力メッセージ

ダッシュボード上に入力パラメータに応じたテーブルが出力されます。
