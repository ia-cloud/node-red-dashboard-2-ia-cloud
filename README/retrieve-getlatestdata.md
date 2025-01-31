# node-red-dashboard-2-ia-cloud - retrieve-getlatestdata

## 名称

retrieve-getlatestdataノード

## 機能概要

このノードは指定したDynamoDBから直近1件分のiacloudオブジェクトを取得し、node-red ダッシュボード：[node-red-dashboard](https://github.com/node-red/node-red-dashboard)、iacloudダッシュボード2ノード：[node-red-dashboard-2-ia-cloud](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud)の各ウィジェットへ入力する際の形へ変換することができます。

対象ウィジェットは以下の通りです。

### (1) node-red ダッシュボード：[node-red-dashboard](https://github.com/node-red/node-red-dashboard)

- ボタン
- ゲージ
- 数値
- テキスト
- テキスト入力
- スライダー
- チャート(*リアルタイム入力の場合)

### (2) iacloudダッシュボードノード-2：[node-red-dashboard-2-ia-cloud](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud)

- ランプ([ui-lamps-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-lamps.md))
- 数値変換([ui-num-dt-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-num-dt.md))

※チャートへの時系列データの入力は「ノード：[retrieve-getchartdata](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/retrieve-getchartdata.md)」を使用してください。

本ノードはAWS-SDK DynamoDB関数をラップしており、DynamoDBからデータを取得する処理にはQueryを使用しています。
より詳細に知るには、[APIドキュメント](https://docs.aws.amazon.com/sdkforruby/api/Aws/DynamoDB/Client.html)を参照してください。

このノードを使用するには、DynamoDB操作ユーザの情報が必要になります。ユーザ情報は別途発行・取得する必要があります。

## プロパティー

取得するデータに応じて以下のパラメータを設定します。

- ### 名前

  フロー上で表示するノード名を設定します。

- ### ユーザID

  使用するDynamoDB操作ユーザのIDを設定します。

- ### パスワード

  使用するDynamoDB操作ユーザのパスワードを設定します。

- ### テーブル名

  検索を行うテーブル名を設定します。

- ### オブジェクトキー

  検索を行うデータのobjectKeyを設定します。

- ### 項目設定

  出力するdataNameを設定します。
  また、表示項目に「数値データ」が選択されている場合、
  出力結果のdataName部分の表示名を変更することができます。
  対応するdataNameと出力したい表示名を入力します。
  表示名が未入力の場合は、dataNameをそのまま出力します。

- ### 繰り返し

  繰り返し処理を行う場合は本項目を設定します。
  設定後、繰り返し間隔を設定します。

- ### 表示桁数

  取得データの表示桁数の設定をします。
  小数第3位～100の位、丸めなしの設定が可能です。

- ### 並び順

  検索結果の並び順(昇順/降順)を設定します。
  アグリゲーション処理が設定されている場合、並び順を指定することはできません。

## 出力メッセージ

入力されたiacloudオブジェクトをdashborad - chartへ入力する際の形に変換した結果が出力されます。
項目設定に指定されたdataNameのデータが存在しなかった場合、該当部分にはnullが出力されます。

### (1) ランプゲージ

機能概要 (1)dashboard にて記載した全ノード、(2)iacloudダッシュボードノードに記載したランプノード([ui-lamps-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-lamps.md)) への入力メッセージを出力します。
以下に例を示します。

    [
        22.2, 18.2, 26.3, 19.6, null
    ]

### (2) 数値データ

機能概要 (2)iacloudダッシュボードノードに記載した数値変換ノード([ui-num-dt-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-num-dt.md))への入力メッセージを出力します。
以下に例を示します。

    [
        [
            "温度ch1",
            22.2,
            "℃"
        ],
        [
            "TEMP-M01temp2",
            18.2,
            "℃"
        ],
        [
            "温度ch3",
            26.3,
            "℃"
        ],
        [
            "TEMP-M01temp4",
            19.6,
            "℃"
        ]
    ]
