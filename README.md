# node-red-dashboard-2-ia-cloud

## 名称
ia-cloud　可視化ノード version2.0



## 機能概要

このパッケージは、[node-red-contrib-ia-cloud-fds](https://github.com/ia-cloud/node-red-contrib-ia-cloud-fds)によりia-cloud Center Server（CCS）へ格納されたオブジェクトを、ダッシュボードを用いて可視化を行うノードの集合体です。

## ノード一覧
以下のノードが保存されています。


- ### CCSへ格納されたオブジェクトの取得・変換に関するノード

|ノード名|説明|
|:-|:-|
|[retrieve](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/retrieve.md)|DynamoDBに格納されたia-cloudオブジェクトを取得|
|[retrieve-getchartdata](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/retrieve-getchartdata.md)|DynamoDBに格納されたia-cloudオブジェクトを取得し、アグリゲーション・表示名変更を行った後にdashborad - chartへ入力する際の形に変換|
|[retrieve-getlatestdata](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/retrieve-getlatestdata.md)|DynamoDBに格納されたia-cloudオブジェクトを取得し、dashboradの各ウィジェットへ入力する際の形に変換|

- ### ダッシュボードを用いて可視化を行うノード
ウィジェット追加方法[[Building Third Party Widgets](https://dashboard.flowfuse.com/contributing/widgets/third-party.html)]を参考に実装


|ノード名|説明|
|:-|:-|
|[ui-dateset-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-dateset.md)|ダッシュボードから開始日時・終了日時を取得|
|[ui-oprstatus-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-oprstatus.md)|入力値を基にダッシュボードへ稼働状況グラフを表示|
|[ui-table-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-table.md)|入力値を基にダッシュボードへテーブル(表)を表示|
|[ui-spreadsheet-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-spreadsheet.md)|ia-cloud アラーム&イベントモデルデータの集計を行いダッシュボードへテーブル(表)形式で表示|
|[ui-lamps-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-lamps.md)|入力値を基にダッシュボードへ表示灯を表示|
|[ui-num-dt-2](https://github.com/ia-cloud/node-red-dashboard-2-ia-cloud/blob/master/README/ui-num-dt.md)|入力値を基にダッシュボードへ「数値」もしくは「日時」を表示|