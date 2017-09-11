var DM = function () {
    function merge_object(target, source) {
        for (var property in source) {
            if (source.hasOwnProperty(property)) {
                var sourceProperty = source[property];
                if (typeof sourceProperty === 'object' && target.hasOwnProperty(property)) {
                    if (sourceProperty === null) {
                        // typeof null === 'object' 表示不存在
                        target[property] = sourceProperty;
                    }
                    target[property] = merge_object(target[property], sourceProperty);
                } else {
                    target[property] = sourceProperty;
                }
            }
        }
        return target;
    }

    function set_invalid(p) {
        for (var instance_id in DM.instances_map) {
            var instance = DM.instances_map[instance_id];
            if (!instance.invalid && instance.rel.indexOf(p) > -1) {
                instance.invalid = true;
                continue;
            }
        }
    }

    function dm_get_data_from_klines(ins_id, dur_id, data_id, serial_selector) {
        var klines = DM.datas.klines;
        if( klines
            && klines[ins_id]
            && klines[ins_id][dur_id]
            && klines[ins_id][dur_id].data[data_id]
            && klines[ins_id][dur_id].data[data_id][serial_selector]
        ) {
            return klines[ins_id][dur_id].data[data_id][serial_selector];
        } else {
            return NaN;
        }
    }

    function dm_get_data_from_ticks(ins_id, data_id, serial_selector) {
        if (DM.datas
            && DM.datas.ticks
            && DM.datas.ticks[ins_id]
            && DM.datas.ticks[ins_id].data
            && DM.datas.ticks[ins_id].data[data_id]
            && DM.datas.ticks[ins_id].data[data_id][serial_selector]
        ) {
            return DM.datas.klines[ins_id].data[data_id][serial_selector];
        } else {
            return NaN;
        }
    }

    function set_invalid_by_prefix(perfix) {
        for (var instance_id in DM.instances) {
            if (!DM.instances[instance_id].invalid && DM.instances[instance_id].rels.includes(perfix)) {
                DM.instances[instance_id].invalid = true;
                continue;
            }
        }
    }

    function dm_update_data(diff) {
        // 将 diff 中所有数据更新到 datas 中
        merge_object(DM.datas, diff);
        // 将 diff 中所有数据涉及的 instance 设置 invalid 标志
        // 只检查了 klines ins_id dur_id 里的数据
        if (diff.klines) {
            for (var key in diff.klines) {
                for (var dur in diff.klines[key]) {
                    var perfix = key + '.' + dur;
                    set_invalid_by_prefix(perfix);
                }
            }
            // 重新计算 instance
            dm_recalculate();
        }
    }

    function dm_recalculate() {
        for (var instance_id in DM.instances) {
            if (DM.instances[instance_id].invalid) {
                DM.instances[instance_id].invalid = false;
                TM.recalc_indicator_by_id(instance_id);
            }
        }
    }

    function dm_get_tdata(ins_id, data_id, serial_selector, instance_id) {
        var path = ins_id + '.0';
        if (DM.instances[instance_id]) {
            if (DM.instances[instance_id].rels.indexOf(path) < 0) {
                DM.instance_rels[path].push(instance_id);
            }
        } else {
            DM.instance_rels[path] = [instance_id];
        }
        // 返回数据
        return dm_get_data_from_ticks(ins_id, data_id, serial_selector);
    }

    function dm_get_kdata(ins_id, dur_id, data_id, serial_selector, instance_id) {
        var path = ins_id + '.' + dur_id;
        if (DM.instances[instance_id]) {
            if (!DM.instances[instance_id].rels.includes(path)) {
                DM.instances[instance_id].rels.push(path);
            }
        } else {
            DM.instances[instance_id].rels = [path];
        }
        // 返回数据
        try{
            return DM.datas.klines[ins_id][dur_id].data[data_id][serial_selector];
        }catch (e){
            return NaN;
        }
        // return dm_get_data_from_klines(ins_id, dur_id, data_id, serial_selector);
    }

    function dm_get_k_range(ins_id, dur_id, instance_id) {
        var d = DM.datas;
        var [view_left, view_right] = [DM.instances[instance_id].view_left, DM.instances[instance_id].view_right];
        view_left = parseInt(view_left);
        view_right = parseInt(view_right);
        if (view_left > -1 && view_right > -1) {
            if (d && d.klines && d.klines[ins_id] && d.klines[ins_id][dur_id] && d.klines[ins_id][dur_id].data) {
                var res = d.klines[ins_id][dur_id].data;
                var sorted_keys = Object.keys(res).sort((a, b) => {
                    return (parseInt(a) - parseInt(b))
                });
                var [first_id, last_id] = [sorted_keys[0], sorted_keys[sorted_keys.length - 1]];
                first_id = parseInt(first_id);
                last_id = parseInt(last_id);
                var result_left_id = first_id > view_left ? first_id : view_left;
                var result_right_id = last_id < view_right ? last_id : view_right;
                return [result_left_id, result_right_id];
            }
        }
        return undefined;
    }

    function Instance(id) {
        this.instance_id = id;
        this.rels = [];
        this.ins_id = '';
        this.dur_nano = -1;
        this.invalid = false;
        this.view_left = -1;
        this.view_right = -1;
    }

    Instance.prototype.setByIndicatorInstance = function (obj) {
        if (obj.ins_id == '' || obj.dur_nano == -1 || obj.view_left == -1 || obj.view_right == -1) {
            this.invalid = false;
        } else if (this.ins_id != obj.ins_id
            || this.dur_nano != obj.dur_nano
            || this.view_left != obj.view_left
            || this.view_right != obj.view_right) {
            this.invalid = true;
            this.rels = [];
            this.ins_id = obj.ins_id;
            this.dur_nano = obj.dur_nano;
            this.view_left = obj.view_left;
            this.view_right = obj.view_right;
        }
    }

    function dm_reset_kdata_range(obj) {
        if (!DM.instances[obj.instance_id]) {
            DM.instances[obj.instance_id] = new Instance(obj.instance_id);
        }
        DM.instances[obj.instance_id].setByIndicatorInstance(obj);
    }

    function dm_clear_data() {
        // 清空数据
        DM.instances = {};
        DM.datas = {};
    }

    return {
        instances: {},
        datas: {},
        get_tdata: dm_get_tdata,
        get_kdata: dm_get_kdata,
        get_kdata_range: dm_get_k_range,
        reset_indicator_instance: dm_reset_kdata_range,
        update_data: dm_update_data,
        clear_data: dm_clear_data
    }
}

();
