<template>
    <!-- Component must be wrapped in a block so props such as className and style can be passed in from parent -->
    <div className="ui-num-dt-wrapper">
        <!-- テーブル表示(数値) -->
        <table id="table" class="table" v-if="props.datatype == 'Number'">
            <tbody>
                <tr v-for="row in messages[id].payload">
                    <template v-for="item in row">
                        <td v-if="typeof item == 'number'" :style="{ fontSize: '14px', padding: '6px 12px', textAlign: 'right', fontWeight: 'bold' }">
                            {{ item }}
                        </td>
                        <td v-else :style="{ fontSize: '14px', padding: '6px 12px', textAlign: 'right' }">
                            {{  item }}
                        </td>
                    </template>
                </tr>
            </tbody>
        </table>

        <!-- テーブル表示(日時) -->
        <table id="table" class="table" v-if="props.datatype == 'Datetime'">
            <tbody>
                <tr v-for="row in messages[id].payload">
                    <td v-for="item in row" :style="{ fontSize: '14px', padding: '6px 12px', textAlign: 'right' }">
                        {{ item }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>


<script>
import toTitleCase from 'to-title-case'
import { markRaw } from 'vue'
import { mapState } from 'vuex'

export default {
    name: 'UINumDt',
    inject: ['$socket'],
    props: {
        /* do not remove entries from this - Dashboard's Layout Manager's will pass this data to your component */
        id: { type: String, required: true },
        props: { type: Object, default: () => ({}) },
        state: { type: Object, default: () => ({ enabled: false, visible: false }) }
    },
    setup(props) {
        console.info('UINumDt setup with:', props)
        console.debug('Vue function loaded correctly', markRaw)
    },
    data() {
        return {
            input: {
                title: 'some text here will base turned into title case.'
            },
            params: this.params
        }
    },
    computed: {
        titleCase() {
            return toTitleCase(this.input.title)
        },
        ...mapState('data', ['messages'])
    },
    created() {

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
            See the ui-num-dt.js file for how to subscribe to these.
        */
        sendDate() {
            this.$socket.emit('num_dt-event', this.id, {
                payload: 'NumDt Event',
            })
        }
    }
}
</script>
