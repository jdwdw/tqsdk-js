
//连接到主进程
WS.init();


// list_init

$(function(){
    // ui init
    var editor = ace.edit('editor');
    editor.getSession().setMode("ace/mode/javascript");
    editor.$blockScrolling = Infinity;


    // var result = ace.edit("result");
    // result.getSession().setMode("ace/mode/json");
    // result.$blockScrolling = Infinity;


    var button = document.getElementById('btn_editor_save');
    Rx.Observable.fromEvent(button, 'click')
    .subscribe(function($event){
        // todo: 存储编辑函数
        localStorage.setItem('MA',editor.getValue());
        // todo: 重新求值
        TM.recalc_indicators();
    });

    console.log(Indicator.Class)
    var Indicators = _.map('name')(Indicator.Class);

    var listmenu = new ComListMenu('list_menu').init(Indicators);

    var run = document.getElementById('btn_editor_run');
    Rx.Observable.fromEvent(run, 'click')
    // .throttleTime(1000)
    // .scan(count => count + 1, 0)
        .subscribe(function($event){
            var i = eval(editor.getValue())
            console.log(i)
            // todo: 重新求值
            TM.recalc_indicators();
        });

    // var btn_result_clean = document.getElementById('btn_result_clean');
    // Rx.Observable.fromEvent(btn_result_clean, 'click')
    // // .throttleTime(1000)
    // // .scan(count => count + 1, 0)
    //     .subscribe(function($event){
    //         result.setValue('');
    //     });
});


