toast("开始运行...");

function findTree(node, path, findfunc) {
    if (!node) {
        return;
    }
    if (findfunc(node, path) === true) {
        return node;
    }
    var children = node.children();
    for (var j = 0; j < children.length; j++) {
        var found = findTree(children[j], path + "." + j, findfunc);
        if (found) {
            return found;
        }
    }
    return null;
}

function foreachPath(node, callback) {
    findTree(node, "", function (subnode, path) {
        callback(subnode, path);
        return false;
    });
}

function findByPath(path) {
    root = selector().findOnce();
    if (!root) {
        log("root not found");
        return;
    }
    return findTree(root, "", function (_, nodepath) {
        return nodepath == path;
    });
}

function parseItemMeta(node, into) {
    for (var i = 0; i < node.childCount(); i++) {
        var val = node.child(i).text();
        switch (i) {
            case 0:
                // 22:51:00.167/D: path: .1.0.0, text: 84
                into.table = val;
                break;
            case 1:
                // 22:51:00.169/D: path: .1.0.1, text: 桌号
                break;
            case 2:
                // 22:51:00.170/D: path: .1.0.2, text: 到店订单
                into.type = val;
                break;
            case 3:
                // 22:51:00.171/D: path: .1.0.3, text: 2023-11-25 11:24
                into.date = val;
                break;
        }
    }
    into.id = into.date.replace(/\s+/g, "-") + "-" + into.table;
}

function parseItem(node, cond) {
    var data = {
        items: [],
    };
    var endlist = false;
    for (var j = 0; j < node.childCount(); j++) {
        // 解析订单基本信息
        if (j == 0) {
            parseItemMeta(node.child(j), data);
            // 检查订单是否符合条件
            if (!cond(data)) {
                return null;
            }
            continue;
        }
        var val = node.child(j).text();
        // 解析订单内容列表，直到遇到共n件
        if (/共(\d+)件/.exec(val)) {
            endlist = true;
        }
        if (!endlist) {
            j++; // 订单列表占两个节点，跳过第二个
            data.items.push(val + " " + node.child(j).text()); // 价格
            continue;
        }
        // 开始解析订单总计
        data.totalcount = val;
        j++; //   text: 总计
        j++; //   text: ￥
        j++; //   text: 16.00
        data.totalPrice = node.child(j).text();
        j++; //
        // 开始解析订单附加信息
        // 附加信息有两种，一种是必填，一种是留言
        addtional: while (true) {
            key = node.child(j).text();
            switch (key) {
                case "必填":
                    j++; // skip
                    data.address = node.child(j).text();
                    j++; // skip
                    j++; // skip 复制
                    j++; // skip 标记完成
                    break;
                case "留言":
                    j++; // skip
                    data.message = node.child(j).text();
                    j++; // skip
                    j++; // skip
                    j++; // skip 标记完成
                    break;
                default:
                    // 如果遇到其他信息，退出循环
                    break addtional;
            }
        }
        // 结束解析
        break;
    }
    return data;
}

function parseContent(node, cond) {
    list = [];
    listmeta = {};
    children = node.children();
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        // 第一行是表头
        if (i == 0) {
            for (var j = 0; j < child.childCount(); j++) {
                var val = child.child(j).text();
                switch (j) {
                    // path: .5, text: 11月25日
                    case 5:
                        listmeta.date = val;
                        break;
                    case 6:
                        listmeta.total = val;
                        break;
                }
            }
            continue;
        }
        var item = parseItem(child, cond);
        if (item) {
            list.push(item);
        }
    }
    return list;
}

function look(cond) {
    // 忽略新订单
    if (false) {
        var refresh = text("您有新的订单").findOnce();
        if (refresh) {
            toast("有新订单... 刷新...");
            log("有新订单... 刷新...");
            refresh.click();
            sleep(3000);
        }
    }
    node = findByPath(".0.0.0.1.1.0.1.1.1.0.0.0");
    if (node) {
        return parseContent(node, cond);
    } else {
        return [];
    }
}

function saveToFile(filename, data) {
    var filename = "/sdcard/Documents/" + filename + ".csv";
    var file = open(filename, "w");
    file.write("桌号,类型,时间,总价,总件数,总计,地址,留言,内容\n");
    for (var id in data) {
        var item = data[id];
        msg = item.message;
        if (!msg) {
            msg = "";
        } else {
            msg = "【备注：" + msg + "】";
        }
        addr = item.address;
        var line =
            item.table +
            "," +
            item.type +
            "," +
            item.date +
            "," +
            item.totalPrice +
            "," +
            item.totalcount +
            "," +
            addr +
            "," +
            msg +
            "," +
            item.items.join(" ") +
            "\n";
        file.write(line);
    }
    file.close();
    log("已经保存到文件: " + filename);
    toast("已经保存到文件: " + filename);
}

function debug_printTree() {
    foreachPath(selector().findOnce(), function (node, path) {
        log("path: " + path + ", text: " + node.text());
    });
}

// 先进入店员通页面
while (true) {
    sleep(2000);
    var ok = selector().text("店员通").findOnce();
    if (!ok) {
        toast("未找到店员通页面,请先进入店员通页面");
        app.startActivity({
            action: "VIEW",
            data: "alipays://platformapi/startapp?appId=2018030502317554",
        });
        continue;
    }
    var entry = selector().text("扫码点单").findOnce();
    if (!entry) {
        toast("未找到扫码点单,请先进入店员通页面");
        continue;
    }
    toast("进入扫码点单页面");
    entry.click();
    sleep(5000);
    break;
}

// 检查订单页面
while (true) {
    var ok = selector().text("扫码点单订单").findOnce();
    if (!ok) {
        toast("未找到订单页面");
        var entry = selector().text("扫码点单").findOnce();
        if (!entry) {
            toast("未找到扫码点单,请先进入店员通页面");
            sleep(1000);
            continue;
        }
        entry.click();
        toast("进入订单页面");
        sleep(1000);
        continue;
    }
    break;
}

setScreenMetrics(1080, 1920);

// 下拉刷新
toast("刷新中...");
swipe(540, 400, 540, 1000, 500);
sleep(3000);

totallist = {};
curDate = "";
shouldStop = false;
mintable = 99999;
toast("开始解析订单,期间请勿操作...");
while (true) {
    if (mintable == 1) {
        toast("最小订单号为1,已完成...");
        break;
    }
    if (shouldStop) {
        toast("今日订单已全部扫描,已完成...");
        break;
    }
    var newlist = look(function (data) {
        if (totallist[data.id]) {
            return false;
        }
        return true;
    });
    newlist.forEach(function (v) {
        // 2023-11-25 14:06,32.00
        today = v.date.split(" ")[0];
        if (curDate === "") {
            toast("当前日期: " + today);
            curDate = today;
        }
        if (today !== curDate) {
            log("忽略非当日订单: " + today);
            shouldStop = true;
            return;
        }
        var id = v.id;
        if (totallist[id]) {
            // log("忽略已经存在的订单: " + id);
            return;
        }
        var table = v.table; // 每日订单编号
        if (table < mintable) {
            mintable = table;
            // log("最小订单号: " + table);
        }
        totallist[id] = v;
        log("新订单: " + table);
    });
    // 上滑加载
    swipe(540, 1600, 540, 300, 200);
    sleep(100);
    swipe(540, 1600, 540, 300, 200);
    swipe(540, 1600, 540, 300, 200);
    sleep(100);
    swipe(540, 1600, 540, 300, 200);
    sleep(100);
}

toast("一共解析到" + Object.keys(totallist).length + "个订单");

// 保存到文件
saveToFile(curDate, totallist);

sleep(1000);
back();
