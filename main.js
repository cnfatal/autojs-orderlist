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
                // 22:51:00.172/D: path: .1.0.3, text: 今天 11:24
                if (val.indexOf("今天") != -1) {
                    val = val.replace("今天", nowDate());
                }
                into.date = val;
                break;
        }
    }
    into.id = into.date.replace(/\s+/g, "-") + "-" + into.table;
}

function parseItem(node, cond) {
    var data = {};
    var endlist = false;
    for (var j = 0; j < node.childCount(); j++) {
        // 解析订单基本信息
        if (j == 0) {
            parseItemMeta(node.child(j), data);
            // 检查订单是否符合条件
            if (cond && !cond(data)) {
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
            // 订单列表无法准确区分，合到一起计算
            // 19:46:35.818/D: path: .0.0.0.1.1.0.1.1.1.0.0.0.4.1, text: 蛋挞（甜品无饭） x 1
            // 19:46:35.819/D: path: .0.0.0.1.1.0.1.1.1.0.0.0.4.2, text: ￥11.00
            // 19:46:35.820/D: path: .0.0.0.1.1.0.1.1.1.0.0.0.4.3, text: (一份四个)
            // 19:46:35.821/D: path: .0.0.0.1.1.0.1.1.1.0.0.0.4.4, text: 共1件
            // 19:46:35.823/D: path: .0.0.0.1.1.0.1.1.1.0.0.0.4.5, text: 总计

            // 忽略价格
            if (val.indexOf("￥") != -1) {
                continue;
            }
            data.content = data.content ? data.content + " " + val : val;
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
    if (false) {
        var refresh = text("您有新的订单").findOnce();
        if (refresh) {
            toast("有新订单... 刷新...");
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

function saveToFile(filename, list) {
    var filename = "/sdcard/Documents/" + filename + ".csv";
    var file = open(filename, "w");
    file.write("地址,留言,内容\n");
    list.forEach(function (item) {
        var msg = item.message;
        if (!msg) {
            msg = "";
        } else {
            msg = "【备注：" + msg + "】";
        }
        file.writeline(item.address + "," + msg + "," + item.content);
    });
    file.flush();
    file.close();
    log("已经保存到文件: " + filename);
    toast("已经保存到文件: " + filename);
}

function debug_printTree() {
    foreachPath(selector().findOnce(), function (node, path) {
        log("path: " + path + ", text: " + node.text());
    });
}

function yesterday(date) {
    var today = new Date(date);
    today.setTime(today.getTime() - 24 * 60 * 60 * 1000);
    return (
        today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate()
    );
}

function nowDate() {
    var today = new Date();
    return (
        today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate()
    );
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

var totallist = {};
var curDate = "";
var yesterdayDate = "";
var shouldStop = false;
toast("开始解析订单,期间请勿操作...");
while (true) {
    if (shouldStop) {
        toast("订单已全部扫描,已完成...");
        break;
    }
    var newlist = look(function (data) {
        if (totallist[data.id]) {
            return false;
        }
        // 忽略前日 21.20 前的订单
        // js 日期字符串比较？？？
        if (curDate !== "" && data.date < yesterdayDate + " 21:20") {
            log("忽略前日订单: " + data.id);
            shouldStop = true; // 如果出现被忽略的日期，则不再继续下一轮扫描
            return false;
        }
        shouldStop = true; // 如果出现被忽略的日期，则不再继续下一轮扫描

        return true;
    });
    newlist.forEach(function (v) {
        // 2023-11-25 14:06
        today = v.date.split(" ")[0];
        if (curDate === "") {
            log("设置当前日期: " + today);
            curDate = today;
            yesterdayDate = yesterday(today);
        }
        if (totallist[v.id]) {
            return;
        }
        log("新订单: " + JSON.stringify(v));
        totallist[v.id] = v;
    });
    // 上滑加载
    swipe(540, 1600, 540, 300, 200);
    sleep(100);
    swipe(540, 1600, 540, 300, 200);
    swipe(540, 1600, 540, 300, 200);
    sleep(100);
    swipe(540, 1600, 540, 300, 200);
    sleep(100);

    // 等待 “加载中” 消失
    for (var i = 0; i < 10; i++) {
        var loading = selector().textContains("加载中").findOnce();
        if (loading) {
            sleep(300);
            continue;
        }
        break;
    }
}

toast("一共解析到" + Object.keys(totallist).length + "个订单");

// 时间筛选21.20-次日11.20  11.20-17.30 17.30-21.20
lunchList = [];
afternoonList = [];
dinnerList = [];

for (var i in totallist) {
    var val = totallist[i];
    if (val.date < curDate + " 11:20") {
        log("午餐订单: " + val.id);
        lunchList.push(val);
    } else if (val.date < curDate + " 17:30") {
        log("晚餐订单: " + val.id);
        afternoonList.push(val);
    } else {
        log("夜宵订单: " + val.id);
        dinnerList.push(val);
    }
}
// 保存到文件
saveToFile(curDate + "-lunch", lunchList);
saveToFile(curDate + "-afternonn", afternoonList);
saveToFile(curDate + "-dinner", dinnerList);

sleep(1000);
back();
