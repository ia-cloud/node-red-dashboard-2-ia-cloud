<template>
    <!-- Component must be wrapped in a block so props such as className and style can be passed in from parent -->
    <div className="ui-lamps-wrapper" :class="changeDisplay">
        <div v-for="(item, index) in props.params" id="lamps" :key="index">
            <canvas :ref="`canvas-` + index" width="100" height="100"></canvas>
            <p :style="{ fontSize: '14px', width: '100px', textAlign: 'center', align: 'center' }">
                {{ item.name }}
            </p>
        </div>
    </div>
</template>

<script>
import toTitleCase from 'to-title-case'
import { markRaw } from 'vue'
import { mapState } from 'vuex'

export default {
    name: 'UILamps',
    inject: ['$socket'],
    props: {
        /* do not remove entries from this - Dashboard's Layout Manager's will pass this data to your component */
        id: { type: String, required: true },
        props: { type: Object, default: () => ({}) },
        state: { type: Object, default: () => ({ enabled: false, visible: false }) }
    },
    setup(props) {
        console.info('UILamps setup with:', props)
        console.debug('Vue function loaded correctly', markRaw)


    },
    data() {
        return {
            input: {
                title: 'some text here will base turned into title case.'
            },
            params: this.params,
            canvas: null,
            ctx: null,
            props: this.props
        }
    },
    computed: {
        titleCase() {
            return toTitleCase(this.input.title)
        },
        ...mapState('data', ['messages']),
        changeDisplay() {
            // 向きの切替処理
            switch (this.props.direction) {
                case 'Vertical':
                    return 'lamps-wrapper'
                case 'Horizontal':
                    return 'flex'
            }
        }
    },
    mounted() {
        this.$socket.on('widget-load:' + this.id, (msg) => {
            // load the latest message from the Node-RED datastore when this widget is loaded
            // storing it in our vuex store so that we have it saved as we navigate around
            this.$store.commit('data/bind', {
                widgetId: this.id,
                msg
            })


        })
        this.$socket.on('msg-input:' + this.id, (msg) => {
            // store the latest message in our client-side vuex store when we receive a new message
            this.$store.commit('data/bind', {
                widgetId: this.id,
                msg
            })

            //Node-REDから受け取るランプの配列
            let lamps = msg.lamps;

            //点灯（消灯）状態を描画）
            lamps.forEach((item, index) => {
                //色をrgbに変換
                let color = getColor(item.color);

                //canvas作成
                this.canvas = this.$refs["canvas-"+index][0];
                console.log(this.canvas);
                this.ctx = this.canvas.getContext("2d");

                //コンテキストをリセット
                this.ctx.reset();

                this.ctx.globalAlpha = 1.0;
                //全体を#999999で塗りつぶし

                this.ctx.beginPath();
                this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.fillStyle = "#999999";
                this.ctx.closePath();
                this.ctx.fill();

                //ランプ部分をcolor.offで塗りつぶし
                this.ctx.beginPath();
                this.ctx.fillStyle = color.off;
                if (item.phase == "Square") {
                    this.ctx.rect(20, 20, 60, 60);
                }
                else if (item.phase == "Circle") {
                    this.ctx.arc(50, 50, 40, 0, 2 * Math.PI);
                }
                this.ctx.closePath();
                this.ctx.fill();

                //(点灯している場合は)点灯させる
                this.ctx.beginPath();
                if (item.state) {
                    if (item.phase == "Square") {
                        this.ctx.rect(20, 20, 60, 60);
                    }
                    else if (item.phase == "Circle") {
                        this.ctx.arc(50, 50, 40, 0, 2 * Math.PI);
                    }
                    this.ctx.filter = "blur(7px)";
                    this.ctx.fillStyle = color.on;
                }
                this.ctx.closePath();
                this.ctx.fill();

            })

        })
        this.drawCanvasFst();

        // tell Node-RED that we're loading a new instance of this widget
        this.$socket.emit('widget-load', this.id)
    },
    unmounted() {
        /* Make sure, any events you subscribe to on SocketIO are unsubscribed to here */
        this.$socket?.off('widget-load' + this.id)
        this.$socket?.off('msg-input:' + this.id)
    },
    methods: {
        /*
            widget-action just sends a msg to Node-RED, it does not store the msg state server-side
            alternatively, you can use widget-change, which will also store the msg in the Node's datastore
        */
        send(msg) {
            this.$socket.emit('widget-action', this.id, msg)
        },
        alert(text) {
            alert(text)
        },
        /*
            You can also emit custom events to Node-RED, which can be handled by a custom event handler
            See the ui-lamps.js file for how to subscribe to these.
        */
        test() {
            console.info('custom event handler:')
            this.$socket.emit('my-custom-event', this.id, {
                payload: 'Custom Event'
            })
        },

        drawCanvasFst() {
            //初期の消灯状態を描画
            this.props.params.forEach((item, index) => {
                let color = getColor(item.color);
                this.canvas = this.$refs["canvas-"+index][0];
                console.log(this.canvas);
                this.ctx = this.canvas.getContext("2d");

                this.ctx.globalAlpha = 1.0

                this.ctx.beginPath();
                //全体を#999999で塗りつぶし
                this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.fillStyle = "#999999";
                this.ctx.closePath();
                this.ctx.fill();


                this.ctx.beginPath();
                if (item.phase == "Square") {
                    this.ctx.rect(20, 20, 60, 60);
                }
                else if (item.phase == "Circle") {
                    this.ctx.arc(50, 50, 40, 0, 2 * Math.PI);
                }
                this.ctx.fillStyle = color.off;
                this.ctx.closePath();
                this.ctx.fill();
            });
        }
    }
}


function getColor(color) {
    let onoff_color = {};
    if (color == 'Red') {
        onoff_color.on = "rgb(255, 30, 30)";
        onoff_color.off = "rgb(80, 80, 80)";
    } else if (color == 'Green') {
        onoff_color.on = "rgb(10, 255, 10)";
        onoff_color.off = "rgb(80, 80, 80)";
    } else if (color == 'Blue') {
        onoff_color.on = "rgb(70, 70, 255)";
        onoff_color.off = "rgb(80, 80, 80)";
    } else if (color == 'Yellow') {
        onoff_color.on = "rgb(255, 255, 30)";
        onoff_color.off = "rgb(80, 80, 80)";
    } else if (color == 'Orange') {
        onoff_color.on = "rgb(255, 170, 30)";
        onoff_color.off = "rgb(80, 80, 80)";
    } else if (color == 'Purple') {
        onoff_color.on = "rgb(255, 30, 255)";
        onoff_color.off = "rgb(80, 80, 80)";
    } else if (color == 'White') {
        onoff_color.on = "rgb(255, 255, 255)";
        onoff_color.off = "rgb(80, 80, 80)";
    }
    return onoff_color;
}

</script>

<style scoped>
.lamps-wrapper {
    display: inline;
}
.flex {
    display: flex;
}
</style>