const WS = new TqWebSocket('ws://127.0.0.1:7777/', {
    onmessage: function (message) {
        if (message.aid === 'rtn_data') {
            //收到行情数据包，更新到数据存储区
            for (let i = 0; i < message.data.length; i++) {
                DM.update_data(message.data[i]);
            }
        }
    },

    onopen: function () {
        WS.sendJson({
            aid: 'sync_datas',
            sync_datas: {},
        });
    },

    onclose: function () {
        DM.clear_data();
    },

    onreconnect: function () {
        
    },
});

WS.init();

const trader_context = function() {
    function insertOrder(ord){
        var order_id = OrderIds.next().value;
        var send_obj = {
            "aid": "insert_order",
            "order_id": order_id,
            "user_id": DM.get_session().user_id,
            "exchange_id": ord.exchange_id,
            "instrument_id": ord.instrument_id,
            "direction": ord.direction,
            "offset": ord.offset,
            "volume": ord.volume,
            "price_type": "LIMIT",
            "limit_price": ord.limit_price
        };
        WS.sendJson(send_obj);
        var session_id = DM.get_session().session_id;
        var id = session_id+'|'+order_id;
        if(DM.get_order(id)){
            return DM.get_order(id);
        }else{
            var orders = {};
            orders[id] = {
                order_id: order_id,
                session_id: session_id,
                exchange_order_id: id,
                status: "UNDEFINED",
            }
            DM.update_data({
                "trade":{
                    "SIM":{
                        "orders": orders
                    }
                }
            });
            return DM.get_order(id);
        }
    };

    function cancelOrder(order){
        if(order.exchange_order_id){
            var send_obj = {
                "aid": "cancel_order",          //必填, 撤单请求
                "order_session_id": order.session_id,     //必填, 委托单的session_id
                "order_id": order.order_id,             //必填, 委托单的order_id
                "exchange_id": order.exchange_id,         //必填, 交易所
                "instrument_id": order.instrument_id,      //必填, 合约代码
                //"action_id": "0001",            //当指令发送给飞马后台时需填此字段, 
                "user_id": DM.get_session().user_id,             //可选, 与登录用户名一致, 当只登录了一个用户的情况下,此字段可省略
            }
            WS.sendJson(send_obj);
            return order;
        }else {
            console.info('CANCEL_ORDER:', '传入的参数不是 ORDER 类型', order);
            return null;
        }
    }
        
    function thunkify(fn) {
        return function() {
            var args = new Array(arguments.length);
            var ctx = this;
        
            for (var i = 0; i < args.length; ++i) {
                args[i] = arguments[i];
            }
        
            return function (done) {
                var called;
        
                args.push(function () {
                    if (called) return;
                    called = true;
                    done.apply(null, arguments);
                });
        
                try {
                    fn.apply(ctx, args);
                } catch (err) {
                    done(err);
                }
            }
        }
    }

    var getConditions = function(params){
        var cdts = {};
        if(params instanceof Object){
            if(params instanceof Array){
                // begin with and
            }else{
                // begin with or
            }
        }else{
            console.log('传入的参数类型错误')
        }
    }

    var wait = function(params, cb){
        var TIMEOUT = params.TIMEOUT ? parseInt(params.TIMEOUT) : 5000;
        
        var cdt = getConditions(params);

        var st = setTimeout(()=>{
            clearInterval(si);
            cb(null, {
                status: "TIMEOUT"
            })
        }, TIMEOUT);

        var checkItem =  function(node){
            if(typeof node == 'function'){
                return node();
            }else if(node instanceof Array){
                // array &&
                for(var i in node){
                    if(!checkItem(node[k])){
                        return false;
                    }
                }
                return true;
            }else{
                // object ||
                for(var k in node){
                    if(checkItem(node[k])){
                        return true;
                    }
                }
                return false;
            }
        }

        var check = function(){
            for(var k in params){
                if(checkItem(params[k])){
                    clearTimeout(st);
                    clearInterval(si);
                    cb(null, {
                        status: k
                    })
                    break;
                }
            }
        }

        var si = setInterval(check, 100);

    }

    return {
        INSERT_ORDER: insertOrder,
        CANCEL_ORDER: cancelOrder,
        WAIT: thunkify(wait),
        GET_ACCOUNT: DM.get_account,
        GET_POSITION: DM.get_positions,
        GET_SESSION: DM.get_session,
        GET_ORDER: DM.get_order,
    }
} ();

function TradeRun(fn, endcontent){
    var gen = fn(trader_context);

    function next(err, data){
        var result = gen.next(data);
        if(result.done || TD.endSignal) {
            if(onTradeEnd) onTradeEnd();
            TD.status = 'free';
            TD.endSignal = false;
            return;
        }
        result.value(next);
    }

    next();
}

function* GenerateKey() {
    let i = 0;
    while (true) {
        yield i.toString(36);
        i++;
    }
}
OrderIds = GenerateKey()

const TD = (function () {
     
    function execTrader(content) {
        let funcName = content.name;
        let code = content.code;
        trader_context.UI_VALUES = content.params;

        let id = OrderIds.next().value;
        if(onTradeStart) onTradeStart();
        TD.status = 'running';
        
        try {
            
            TradeRun(self[funcName], {
                id: id,
                className: funcName,
            });
            
        }catch(e){
            console.log(e)
        }

    }

    var endTrader = function(){
        if(TD.status === 'running') TD.endSignal = true;
    }

    return {
        status: 'free', // 'running'
        endSignal: false,
        execTrader: execTrader,
        endTrader: endTrader,
    };
}());
