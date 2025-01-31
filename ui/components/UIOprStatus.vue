<template>
    <!-- Component must be wrapped in a block so props such as className and style can be passed in from parent -->
    <div className="ui-oprstatus-wrapper">
        <!-- タイトル表示 -->
        <p :style="{ fontSize: '14px', width: '100%', textAlign: 'center', align: 'center' }">{{ props.label }}</p>
        <div :style="{ textAlign: 'center', align: 'center' }">
            <table id='statusTitle_table' :style="{ width: '100%', align: 'center' }">
                <tbody>
                    <tr>
                        <td v-for='item in messages[id].series' :style="{ fontSize: '14px', align: 'center' }">
                            {{ item}}
                        </td>
                    </tr>
                </tbody>
            </table>

            <br>
            <table id='statusBar_table'
                :style="{ width: '100%', align: 'center', padding: '0px 5% 0px 5%', borderSpacing: 0 }">
                <tbody>
                    <tr>
                        <td v-for='item in messages[id].graphData  ' :style="{
                            backgroundColor: item.statusColor, height: '15px', align: 'center', padding: '0px 0px 0px 0px'}">
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- X軸表示 -->
            <table id='statusAxis_table'
                :style="{ width: '100%', fontSize: '8px', align: 'center', padding: '0px 0px 0px 0px' }">
                <tbody>
                    <tr>
                        <td v-for='item in messages[id].xaxisData ' :style="{ align: 'center', padding: '0px 0px 0px 0px' }">
                            {{ item.x }}
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- 凡例表示 -->
            <div v-if="props.guide == 'display'">
                <table id='statusList_table' :style="{ fontSize: '12px' }">
                    <tbody>
                        <tr>
                            <td v-for='item in messages[id].statusObject' :style="{ padding: '15px' }">
                                <span :style="{ color: item.statusColor, fontSize: '20px' }">■</span>{{ item.statusLabel }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script>
import toTitleCase from 'to-title-case'
import { markRaw } from 'vue'
import { mapState } from 'vuex'

export default {
    name: 'UIOprStatus',
    inject: ['$socket'],
    props: {
        /* do not remove entries from this - Dashboard's Layout Manager's will pass this data to your component */
        id: { type: String, required: true },
        props: { type: Object, default: () => ({}) },
        state: { type: Object, default: () => ({ enabled: false, visible: false }) }
    },
    setup(props) {
        console.info('UIOprStatus setup with:', props)
        console.debug('Vue function loaded correctly', markRaw)
    },
    data() {
        return {
            input: {
                title: 'some text here will base turned into title case.'
            }
        }
    },
    computed: {
        titleCase() {
            return toTitleCase(this.input.title)
        },
        ...mapState('data', ['messages'])
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
        })
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
            See the ui-oprstatus.js file for how to subscribe to these.
        */
        test() {
            console.info('custom event handler:')
            this.$socket.emit('my-custom-event', this.id, {
                payload: 'Custom Event'
            })
        }
    }
}
</script>

