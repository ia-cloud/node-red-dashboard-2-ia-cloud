# node-red-dashboard-2-ui-spreadsheet

## 名称

dashboard-2 - ui-spreadsheetノード

## 機能概要

ウィジェット追加方法[[Building Third Party Widgets](https://dashboard.flowfuse.com/contributing/widgets/third-party.html)]を参考に実装したノードです。
ia-cloudオブジェクトデータの集計結果をテーブル(表)を表示します。

## 入力メッセージ

この関数を利用する際には、「ノード：[retrieve](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/retrieve.md)」から出力されたia-cloudオブジェクトデータを直接本ノードに入力します。
以下に入力データの例を示します。

        {
            "dataObject": {
                "ObjectContent": {
                "contentData": [
                    {
                        "commonName": "Alarm&Event",
                        "dataValue": {
                            "AnECode": "HR100",
                            "AnEdescription": "HR100の警報",
                            "AnEStatus": "on"
                        }
                    },
                    {
                        "commonName": "Alarm&Event",
                        "dataValue": {
                            "AnECode": "HR200",
                            "AnEdescription": "HR200の警報",
                            "AnEStatus": "on"
                        }
                    },
                    {
                        "commonName": "Alarm&Event",
                        "dataValue": {
                            "AnECode": "HR300",
                            "AnEdescription": "HR300の警報",
                            "AnEStatus": "set"
                        }
                    }
                ],
                "contentType": "Alarm&Event"
                },
                "objectDescription": "アラーム",
                "objectKey": "PLCAnE",
                "objectType": "iaCloudObject",
                "timestamp": "2019-04-01T09:00:00+09:00"
            },
            "objectKey": "PLCAnE",
            "timestamp": "2019-04-01T09:00:00+09:00"
        }

## プロパティ

  変換するデータに応じて、以下のパラメータを設定します。

- ### グループ

  結果を出力するダッシュボードグループを設定します。

- ### サイズ

  結果出力時のテーブルサイズを設定します。

- ### ラベル

  ダッシュボード上での表示名を設定します。

- ### 集計データタイプ
  集計するデータを設定します。
  「アラーム&イベント」から選択可能です。

- ### 項目設定
  ダッシュボード上に表示する際の項目を設定します。
  「A&E No,A&E詳細」、「A&E No」、「A&E詳細」から選択可能です。

- ### ステータス
  集計するステータスを設定します。
  「set」、「reset」、「on」、「off」から選択可能です。

- ### ノード名
  フロー上で表示するノード名を設定します。


## 出力メッセージ
ダッシュボード上に入力パラメータに入力されたia-cloud アラーム&イベントモデルデータの集計結果をテーブル(表)形式で出力されます。
