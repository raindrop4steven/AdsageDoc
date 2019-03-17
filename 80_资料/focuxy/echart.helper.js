var __charts = {}
function drawChart(data, config){
    var id;
    var chart;
    id = "chart-" + config.id;
    chart = $('#' + id);
    
    if(chart.length == 0) {
        $(config.html).appendTo('#'+ (config.parent||"charts"));
    }
    data = prepareData(data, config);
    switch(config.type){
        case "multiLine":
            drawMultiLineChart(id, data, config)
            break
        case "wordcloud":
            drawWordcloud(id, data, config)
            break
        case "composeRingBar":
            drawRingBarChart(id, data, config)
            break
        case "ring":
            drawRingChart(id, data, config)
            break
        case "gauge":
            drawGaugeChart(id, data, config)
            break
        case "multiGauge":
            drawMultiGaugeChart(id, data, config)
            break
        case "smallGauge":
            drawSmallGauge(id, data, config)
            break;
        case "stackBar":
            drawStackBarChart(id, data, config)
            break
        case "bar":
            drawBarChart(id, data, config)
            break
        case "map":
            drawMapChart(id, data, config)
            break
    }
}

function prepareData(data, config){
    if(/(tendency)|(ted)/.test(config.name) || /(tendency)|(ted)/.test(config.ref_key) || /(tendency)|(ted)/.test(config.seriesKey)){
        config.isTendency = true
    }
    switch(config.type) {
        case "wordcloud":
            return {
                data: _.map(data, function(o) {
                    return _.extend({
                        name: o.key ? o.key.toUpperCase() : "",
                        value: o.log_value ? o.log_value : (o.score ? o.score : o.doc_count)
                    }, o)
                })
            }
        case "bar":
            var sds = [], lds = [], yds = [];
            data.buckets.forEach(function(bucket, idx) {
                if (!bucket.key) {
                    return
                }
                yds.unshift(wrapper.mediaType(bucket.key))
                var d = {
                    name: wrapper.mediaType(bucket.key),
                    value: bucket.doc_count,
                    sd: bucket
                }
                bucket.score && (d.score = bucket.score)
                bucket.f_value && (d.f_value = bucket.f_value)
                sds.unshift(d)
            })
            return {series: sds, yds: yds}
            break
        case "multiLine":
            var sds = [], lds = [], xds = []; 
            if(config.seriesKey) {
                data.buckets.forEach(function(bucket, idx){
                    lds.push(wrapper.mediaType(bucket.key))
                    bucket[config.seriesKey].buckets.forEach(function(bkt){
                        if(!_.find(xds, function(o){return o.key == bkt.key})){
                            xds.push(bkt)
                        }
                    })
                })
                xds = _.sortBy(xds, function(o){return o.key})
                data.buckets.forEach(function(bucket, idx){
                    sds.push({
                        name: wrapper.mediaType(bucket.key),
                        type: "line", 
                        smooth: true, 
                        stack: config.disableStak ? null : "bucket.key", 
                        areaStyle: {
                            normal: config.ignoreFill ? {color: "rgba(0,0,0,0)"} : {}
                        }, 
                        data: _.map(xds, function(dt){
                            /** time xAxis */
                            // var b = _.find(bucket[config.seriesKey].buckets, function(b){
                            //     return b.key_as_string == dt.key_as_string
                            // })
                            // return {
                            //     name: b.key_as_string.substr(0, 10),
                            //     value: [b.key_as_string.substr(0, 10), b.doc_count||0]
                            // }
                            var b = _.find(bucket[config.seriesKey].buckets, function(b){
                                return b.key_as_string == dt.key_as_string
                            })
                            return b ? b.doc_count : 0
                        })
                    }) 
                })
                xds = _.map(xds, function(o){
                    return o.key_as_string.substr(5, 5)
                })
            }
            else {
                xds = _.map(data.buckets, function(o){return o.key_as_string.substr(5, 5)})
                lds.push(config.seriesName || "")
                sds.push({
                    name: config.seriesName || "", 
                    type: "line", 
                    smooth: true, 
                    stack: "bucket.key", 
                    areaStyle: {
                        normal: {}
                    }, 
                    data: _.map(data.buckets, function(o){return o.doc_count}) 
                }) 
            }

            if(config.isTendency){
                sds = sortSeries(sds)
                lds = sortLegend(lds)
            }
            return {legend: lds, series: sds, xds: xds}

        case "stackBar":
            var yds = [], sds = [], xds = [];
            data.buckets.forEach(function(bucket, idx){
                if(bucket.projects){
                    bucket[config.seriesKey] = bucket.projects[config.seriesKey]
                }
                if(bucket[config.seriesKey].buckets.length > 0){
                    bucket[config.seriesKey].buckets.forEach(function(b){
                        // config.normalize && config.seriesKey == "tendency" && config.normalTed && (b.key = normalizeTendency(b.key))
                        b.key = normalizeTendency(b.key)
                        if(b.key && _.indexOf(xds, b.key) == -1){
                            xds.push(b.key)
                        } 
                    })
                    yds.unshift(wrapper.mediaType(bucket.key))
                }
            })
            xds.forEach(function(o){sds.push({name: o, type: "bar", stack: "总量", data: []})})
            data.buckets.forEach(function(bucket){
                if(bucket[config.seriesKey].buckets.length > 0){
                    xds.forEach(function(cat){
                        var flag = cat.indexOf("负面") >= 0 || cat.indexOf("危机") >= 0 || cat.indexOf("Negative") >= 0 ? -1 : 1
                        var d = _.find(sds, function(o){return o.name == cat})
                        var b = _.find(bucket[config.seriesKey].buckets, function(o){return cat == o.key})
                        d.data.unshift(flag * (b ? b.doc_count: 0))
                    })
                }
            })
            if(config.isTendency){
                sds = sortSeries(sds)
                xds = sortLegend(xds)
            }
            return {yds: yds, sds: sds, xds: xds}
        case "composeRingBar":
            var sds = [], sns = [];
            data.buckets.forEach(function(bucket){
                bucket[config.seriesKey].buckets && bucket[config.seriesKey].buckets.forEach(function(b){
                    sns.push(wrapper.mediaType(bucket.key))
                    if(!_.find(sds, function(o){return o.name == b.key})){
                        sds.push({name: b.key, value: []})
                    }
                })
            })

            data.buckets.forEach(function(bucket){
                bucket[config.seriesKey].buckets && bucket[config.seriesKey].buckets.forEach(function(b){
                    var d = _.find(sds, function(o){return o.name == b.key})
                    if(d){
                        d.value.push(b.doc_count)
                    }
                })
            })
            return {seriesData: sds, seriesNames: _.uniq(sns)}
            break
        case "ring":
            var sds = [],total = 0
            data.buckets.forEach(function(bucket){
                var key = bucket.key
                if(/.*tendency.*/.test(config.name)){
                    key = normalizeTendency(key)
                }
                config.wrapper && wrapper[config.wrapper] && (key = wrapper[config.wrapper](key))
                total+=bucket.doc_count
                var d = _.find(sds, function(o){return o.name == key})
                if(d){d.value += bucket.doc_count}
                else{
                    sds.push({name: key, value: bucket.doc_count})        
                }
            })
            if(config.isTendency){
                sds = sortSeries(sds)
            }
            return {sds: sds, total: total}
            break
        case "gauge":
            return _.find(data, function(o){
                return o.key == config.seriesKey
            })
            break;
        case "multiGauge":
        case "smallGauge":
            var gds = {};
            ["total", "negative", "negative_rate"].forEach(function(key){
                gds[key] = _.find(data, function(o){
                    return o.key == key
                })
            })
            return gds
            break;
        case "map":
            var ds = [], max = 0
            data.buckets.forEach(function(bucket){
                var key = bucket.key
                if(key == "海外"){
                    return;
                }
                bucket.doc_count && bucket.doc_count.value && (bucket.doc_count = bucket.doc_count.value)
                config.wrapper && wrapper[config.wrapper] && (key = wrapper[config.wrapper](key))
                max = Math.max(bucket.doc_count, max)
                var d = _.find(ds, function(o){return o.name == key})
                if(d){
                    d.value += bucket.doc_count
                }
                else{
                    ds.push({name: key, value: bucket.doc_count})        
                }
            })
            return {data: ds, max: max} 
            break;
        default :
            return data
            break;
    }
}

function sortSeries(sds){
    sds.forEach(function(o, idx){
        switch(o.name) {
            case "正面":
                o.sort = 0
                break;
            case "负面":
                o.sort = 2
                break;
            case "中性":
                o.sort = 1
                break;
            case "平媒":
                o.sort = 0
                break;
            case "手机":
                o.sort = 1
                break;
            case "论坛":
                o.sort = 2
                break;
            case "网络":
                o.sort = 3
                break;
            default:
                o.sort = idx
                break
        }
    })
    sds = _.sortBy(sds, function(o){return o.sort})
    return sds
}

function sortLegend(lbls){
    return _.chain(lbls).map(function(k, idx){
        var o = {k: k}
        switch(k) {
            case "正面":
                o.s = 0
                break;
            case "负面":
                o.s = 2
                break;
            case "中性":
                o.s = 1
                break;
            case "平媒":
                o.s = 0
                break;
            case "手机":
                o.s = 1
                break;
            case "论坛":
                o.s = 2
                break;
            case "网络":
                o.s = 3
                break;
            default:
                o.s = idx
                break
        }
        return o
    })
    .sortBy(function(o){return o.s})
    .map(function(o){return o.k})
    .value()
}

function tooltipMarkPoint(d){
    return '<div style="margin: 6px 5px;float:left;width: 10px;height: 10px;background-color:'+ d.color +';border-radius: 50%;-moz-border-radius: 50%;-webkit-border-radius: 50%;"></div>';
}

function drawStackBarChart(id, data, config){
    var chart = getChartInstance(id, config.theme)
    var option = {
        tooltip : {trigger: 'axis', axisPointer : {type : 'line'} },
        legend: {data: data.xds, top: "25px", left: "10px"},
        grid: {left: '2px', right: '2px', bottom: '10px', top: '50px', containLabel: true },
        xAxis:  {type: 'value', axisLabel: {rotate: 45, formatter: function(value, idx){return numeral(value).format("0a") } } },
        yAxis: {type: 'category', data: data.yds },
        series: data.sds,
        toolbox: {show : true, feature : {mark : {show: true}, dataView : {show: true, readOnly: false}, magicType : {show: true, type: ['line', 'bar']}, restore : {show: true}, saveAsImage : {show: true} } }
    };

    if(config.isTendency && chart._theme.ted_color){
        var colors = []
        var ted_color = chart._theme.ted_color
        var theme_color = chart._theme.color
        data.xds.forEach(function(key, idx){
            colors.push(ted_color[key] || theme_color[idx])
        })
        option.color = colors
    }
    chart.clear()
    chart.setOption(option)
    chart.on("click", function(e){
        var key = e.seriesName
        if(config.ref_key){
            if(window.event.altKey) {
                observeChartFilter({key: key}, config, true);
            }
            else{
                observeChartFilter({key: key}, config)
            }
        }
    })
}

function drawBarChart(id, data, config){
    var src_elem = $('#' + id)
    src_elem.css("height", (data.series.length * 24 + 50) + "px")
    var tips_width = src_elem.width()/2
    var chart = getChartInstance(id, config.theme)
    var colors = chart._theme.color
    var option = {
        tooltip: {
            trigger: 'axis', 
            axisPointer: {type: 'shadow'},
            formatter:  function(d){
                if(Array.isArray(d)){
                    d = d[0]
                }
                var lbl = d.seriesName + "<br/>" + tooltipMarkPoint(d)
                if(d.data && d.data.score){
                    lbl += d.name + ": " + numeral(d.data.value).format("0,0") + "<br/>&nbsp;&nbsp;&nbsp;&nbsp;得分: " + numeral(d.data.score).format("0,0")
                }
                else{
                    lbl += d.name + ": " + numeral(d.value).format("0,0")
                }
                return "<div style='width:"+ (tips_width || 200) +"px; word-break:break-all; white-space: normal; overflow:auto;'>" + lbl + "</div>"
            }
        },
        // grid: {top: 25, bottom: 30, left: config.grid ? config.grid.left || 70: 70 },
        grid: {top: 25, bottom: 30, left: 20, right: 20 },
        toolbox: {show : true, feature : {mark : {show: true}, dataView : {show: true, readOnly: false}, magicType : {show: true, type: ['line', 'bar']}, restore : {show: true}, saveAsImage : {show: true} }},
        xAxis: {
            axisLabel: {
                rotate: 45,
                formatter: function(value, idx){
                    return numeral(value).format("0a")
                }
            },
            type: 'value', position: 'bottom', splitLine: {lineStyle: {type: 'solid', color: '#cfc3bd'} }
        },
        yAxis: {
            type: 'category', 
            data: data.yds, 
            axisLabel: {show: false, margin: 4, formatter: function(o){return o.replace(/^.*\//, "") } } 
        },
        series: [{
            name: config.label,
            type: 'bar',
            barCategoryGap: "2",
            barWidth: "18",
            label: {
                normal: {
                    show: true,
                    position: "insideLeft",
                    formatter: function(params) {
                        return [params.data.name, params.data.value].join("：")
                    },
                    textStyle: {
                        color: "#000"
                    }
                }
            },
            data: data.series,
            itemStyle: {
                normal: {
                    color: function(params){
                        return colors[params.dataIndex % colors.length]
                    },
                    borderWidth: 1
                }
            }
        }]
    }

    if(config.isTendency && chart._theme.ted_color){
        var colors = []
        var ted_color = chart._theme.ted_color
        var theme_color = chart._theme.color
        data.series.forEach(function(d, idx){
            colors.push(ted_color[d.name] || theme_color[idx])
        })
        option.color = colors
    }

    chart.clear()
    chart.setOption(option)

    // chart.on('dataviewchanged', function(params){
    //     var opts = wrapper_options(params.newOption.series[0].data)
    //     chart.clear()
    //     chart.setOption(opts)
    // })

    chart.on("mousemove", function(e){
        var cursor = option.series[0].cursor
        if(window.event.altKey && cursor != "not-allowed"){
            option.series[0].cursor = "not-allowed"
        }
        else if(!window.event.altKey && cursor != "pointer"){
            option.series[0].cursor = "pointer"
        }

        if(option.series[0].cursor != cursor){
            chart.setOption(option)
        }
    })
    if(config.clickEvent){
        chart.on("click", function(params){
            config.clickEvent(params, config)
        })
    }
    else{
        chart.on("click", function(params){
            var data = {key: params.data.name, value: params.data.f_value}
            if(window.event.altKey) {
                observeChartFilter(data, config, true);
            }
            else{
                observeChartFilter(data, config)
            }
        })
    }
}

function drawMultiLineChart(id, data, config){
    var chart = getChartInstance(id, config.theme)
    var xl = data.xds.length
    data.series.forEach(function(s) {
        for (var i = s.data.length; i < xl; i++) {
            s.data.push(0)
        }
    })
    
    var yAxis = {
        type: 'value'
    }

    if (config.valueRange) {
        yAxis.max = config.valueRange.max
    }
    /* 对数轴*/
    // if (config.yAxis_type) {
    //     yAxis.type = config.yAxis_type
    //     yAxis.logBase = 3
    // }

    var option = {
        tooltip: {trigger: 'axis'},
        legend: {data: data.legend, left: "10px", top: "25px"},
        toolbox: {show : true, feature : {mark : {show: true}, dataView : {show: true, readOnly: false}, magicType : {show: true, type: ['line', 'bar', 'stack', 'tiled']}, restore : {show: true}, saveAsImage : {show: true} } },
        grid: {left: '2px', right: '2px', bottom: '25px', top: '50px', containLabel: true},
        xAxis: [{name: "时间", type: 'category', boundaryGap: false, data: data.xds, axisLabel: {rotate: 45 } }],
        // xAxis: [{
        //     name: "时间",
        //     type: 'time',
        //     boundaryGap: false,
        //     axisLabel: {
        //         rotate: 45,
        //         formatter: function(value, index) {
        //             var date = new Date(value)
        //             var texts = [(date.getMonth() + 1), date.getDate()]
        //             return texts.join('/')
        //         }
        //     }
        // }],
        yAxis: [yAxis],
        series: data.series
    };

    if(config.disableToolBox){
        delete option.toolbox
    }

    

    if(config.isTendency && chart._theme.ted_color){
        var colors = []
        var ted_color = chart._theme.ted_color
        var theme_color = chart._theme.color
        data.series.forEach(function(d, idx){
            colors.push(ted_color[d.name] || theme_color[idx])
        })
        option.color = colors
    }
    chart.clear()
    chart.setOption(option)
}

function drawWordcloud(id, data_source, config){
    var chart = getChartInstance(id, config.theme)
    var colors = config.colors || chart._theme.color
    var tips_width = $("#" + id).width() / 3

    function wrapper_options(colors, lbl, data) {
        var mc = config.image
        var opts = {
            tooltip: {
                show: true,
                trigger: 'item', 
                formatter:  function(d){
                    var lbl = d.seriesName + "<br/>" + tooltipMarkPoint(d)
                    if(d.data.log_value) {
                        lbl += d.name + ": " + numeral(d.data.doc_count || d.data.value).format("0,0")
                    }
                    else if(d.data.score){
                        lbl += d.name + ": " + numeral(d.data.doc_count).format("0,0") + "/" + numeral(d.data.bg_count).format("0,0") + "<br/>得分: " + d.data.score.toFixed(10)
                    }
                    else{
                        lbl += d.name + ": " + numeral(d.value).format("0,0")
                    }
                    return "<div style='min-width: "+ (tips_width || 100) +"px'>" + lbl + "</div>"
                } 
            },
            toolbox: {
                show : true, 
                feature : {
                    mark : {show: true}, 
                    dataView : {show: true, readOnly: false}, 
                    saveAsImage : {show: true} 
                } 
            },
            series: [{
                name: lbl,
                type: 'wordCloud',
                // drawOutOfBound: true,
                sizeRange: config.sizeRange || [12, 65],
                rotationRange: config.rotationRange || [-45, 45],
                shape: config.shape || 'circle',
                // ellipticity: -1,
                maskGapWidth: 1,
                drawMask: true,
                width: mc ? mc.chartWidth : (config.chartWidth || '80%'),
                height: mc ? mc.chartHeight : (config.chartHeight || '90%'),
                textPadding: 0,
                textStyle: {
                    normal: {
                        fontFamily: config.fontFamily || 'sans-serif',
                        color: config.customColor ? config.customColor : function(params) {
                            if(colors.length > 0){
                                return colors[params.dataIndex  % colors.length]    
                            }
                            return 'rgb(' + [
                                Math.round(Math.random() * 255),
                                Math.round(Math.random() * 160),
                                Math.round(Math.random() * 230)
                            ].join(',') + ')';
                        }
                    },
                    emphasis: {shadowBlur: 10, shadowColor: '#ddd'}
                },
                data: data
            }]
        }
        if (config.disableToolBox) {
            delete opts.toolbox
        }
        if(config.disableDataView){
            opts.toolbox.feature.dataView.show = false
        }
        if(config.gridSize){
            opts.series[0].gridSize = config.gridSize
        }

        if (mc) {
            var maskImage = new Image()
            maskImage.src = mc.src
            maskImage.onload = function() {
                chart.clear()
                opts.series[0].maskImage = maskImage
                chart.setOption(opts)
            }
        }
        return opts
    }

    var option = wrapper_options(colors, config.label, data_source.data)
    config.click && chart.on('click', config.click)
    chart.on('dataviewchanged', function(params) {
        var opts = wrapper_options(colors, config.label, params.newOption.series[0].data)
        chart.clear()
        chart.setOption(opts)
    })
    chart.clear()
    chart.setOption(option)
}

function drawRingBarChart(id, data, config){
    var chart = getChartInstance(id, config.theme)
    var weekDay = 0
    var seriesNames = data.seriesNames
    var legends = []
    var series = _.map(data.seriesData, function(d){
        legends.push(d.name)
        return {
            type: 'bar',
            data: d.value,
            coordinateSystem: 'polar',
            name: d.name,
            stack: 'a',
            itemStyle: {
                normal: {borderWidth: 4, borderColor: '#ffffff'},
                emphasis: {borderWidth: 0, shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)'}
            }
        }
    })

    var option = {
        tooltip: {formatter: tooltipFormatter },
        angleAxis: {type: 'category', data: seriesNames, z: 30 },
        legend: {data: legends, top: "25px", left: "10px"},
        polar: {center: ['50%', '50%'], radius: "65%", },
        radiusAxis: {},
        toolbox: {
            show : true,
            feature : {
                mark : {show: true},
                dataView : {show: true, readOnly: false},
                saveAsImage : {show: true}
            }
        },
        series: series
    }
    if(config.disableToolBox){
        delete option.toolbox
    }

    chart.clear()
    chart.setOption(option)

    function tooltipFormatter(params) {
        var valuesFormatter = []
        if (params.componentSubType == 'pie') {
            valuesFormatter.push(
                '<div style="border-bottom: 1px solid rgba(255,255,255,.3); font-size: 18px;padding-bottom: 7px;margin-bottom: 7px">' +
                (option.angleAxis.data[weekDay].value || option.angleAxis.data[weekDay]) + '<br>' + '</div>' +
                '<span style="color:' + params.color + '">' + params.name + '</span>: ' + params.value
            )
        } else {
            valuesFormatter.push(
                '<div style="border-bottom: 1px solid rgba(255,255,255,.3); font-size: 18px;padding-bottom: 7px;margin-bottom: 7px">' +
                params.seriesName +
                '</div>' +
                '<span style="color:' + params.color + '">' + params.name + '</span>: ' + params.value + '<br>')
        }

        return valuesFormatter
    }
}

function drawSingleGaugeChart(id, data, config){
    var chart = getChartInstance(id, config.theme)
    var colors = chart._theme.color
    var option = {
        tooltip : {
            formatter: "{a} <br/>{b} : {c}%"
        },
        toolbox: {
            feature: {
                dataView : {show: true, readOnly: false},
                restore: {},
                saveAsImage: {}
            }
        },
        series: [
            {
                axisLine: {
                    lineStyle: {
                        width: 20,
                        // color: [[0.2, colors[0]], [0.4, colors[1]], [0.6, colors[1]], [0.8, colors[1]], [1, colors[2]]]
                    } 
                },
                // axisTick: {length: 10},
                splitLine: {length: 20},
                type: 'gauge',
                min: _.isNumber(data.min) ? data.min : -100,
                max: _.isNumber(data.max) ? data.max : 100,
                center: ['50%', '55%'],
                detail: {formatter:'{value}%'},
                data: [{value: data.value}]
            }
        ]
    };

    if(config.disableToolBox){
        delete option.toolbox
    }
    chart.clear()
    chart.setOption(option)
}

function drawMultiGaugeChart(id, data, config){
    var chart = getChartInstance(id, config.theme)
    var colors = chart._theme.gaugeColor || [[0.25, 'rgba(57,163,30,0.85)'], [0.5, 'rgba(42,116,182,0.85)'], [0.75, 'rgba(250,129,0,0.85)'], [1, 'rgba(209,36,37,0.85)'] ]
    var option = {
        tooltip : {formatter: "{a} <br/>{b}: {c}%"},
        toolbox: {
            feature: {
                dataView : {show: true, readOnly: false},
                restore: {},
                saveAsImage: {}
            }
        },
        series : [
            {
                name: "敏感占比",
                type: 'gauge',
                min: 0,
                max: 100,
                z: 3,
                radius: '80%',
                center: ["50%", "50%"],
                axisLine: {
                    lineStyle: {
                        width: 20,
                        color: colors
                    } 
                },
                splitLine: {length: 20},
                title : {textStyle: {fontSize: 14 }},
                detail : {
                    formatter:'{value}%',
                    textStyle: {fontWeight: 'bolder'}
                },
                data: [{value: data.negative_rate.value, name: "敏感占比"}]
            },
            {
                name: '声量趋势',
                type: 'gauge',
                center: ['20%', '60%'],
                radius: '70%',
                startAngle: 215,
                endAngle: 45,
                min: -100,
                max: 100,
                axisLine: {
                    lineStyle: {
                        width: 15,
                        color: colors
                    } 
                },
                splitLine: {length: 15},
                title : {textStyle: {fontSize: 12 }},
                detail : {
                    formatter:'{value}%',
                    textStyle: {fontSize: 16}
                },
                data:[{value: data.total.value, name: "声量趋势"}]
            },
            {
                name: '敏感趋势',
                type: 'gauge',
                center: ['80%', '60%'],
                radius: '70%',
                startAngle: 135,
                endAngle: -45,
                min: -100,
                max: 100,
                axisLine: {
                    lineStyle: {
                        width: 15,
                        color: colors
                    } 
                },
                splitLine: {length: 15},
                title : {textStyle: {fontSize: 12 }},
                detail : {
                    formatter:'{value}%',
                    textStyle: {fontSize: 16}
                },
                data:[{value: data.negative.value, name: '敏感趋势'}]
            }
        ]
    };

    if(config.disableToolBox){
        delete option.toolbox
    }
    chart.clear()
    chart.setOption(option)
}

function drawSmallGauge(id, data, config){
    var chart = getChartInstance(id, config.theme)
    var colors = chart._theme.color
    var option = {
        tooltip : {formatter: "{a} <br/>{b}: {c}%"},
        toolbox: {
            feature: {
                dataView : {show: true, readOnly: false},
                restore: {},
                saveAsImage: {}
            }
        },
        series : [
            {
                name: "敏感占比",
                type: 'gauge',
                min: 0,
                max: 100,
                z: 3,
                radius: '80%',
                axisLine: {
                    lineStyle: {
                        width: 10,
                        color: [
                            [0.25, 'rgb(57,163,30)'],
                            [0.5, 'rgb(42,116,182)'],
                            [0.75, 'rgb(250,129,0)'],
                            [1, 'rgb(209,36,37)']
                        ]
                    } 
                },
                axisTick: {
                    splitNumber: 5
                },
                axisLabel: {
                    textStyle: {fontSize: 10 },
                    distance: 0,
                    formatter: function(param){
                        if ((param % 20) == 0) {
                            return param
                        }
                    }
                },
                pointer:{
                    width: 3,
                    length:'80%'
                },
                splitLine: {length: 10},
                title : {
                    offsetCenter: [0, '-20%'],
                    textStyle: {fontSize: 10 }
                },
                detail : {
                    formatter:'{value}%',
                    textStyle: {fontSize: 10}
                },
                data: [{value: data.negative_rate.value, name: "敏感占比"}]
            },
            {
                name: '声量趋势',
                type: 'gauge',
                center: ['20%', '60%'],
                radius: '60%',
                startAngle: 215,
                endAngle: 45,
                min: -100,
                max: 100,
                axisLine: {
                    lineStyle: {
                        width: 8,
                        color: [
                            [0.25, 'rgb(57,163,30)'],
                            [0.5, 'rgb(42,116,182)'],
                            [0.75, 'rgb(250,129,0)'],
                            [1, 'rgb(209,36,37)']
                        ]
                    } 
                },
                axisTick: {
                    splitNumber: 2
                },
                splitLine: {length: 8},
                axisLabel: {
                    textStyle: {fontSize: 8 },
                    distance: 0,
                    formatter: function(param){
                        if ((param % 50) == 0) {
                            return param
                        }
                    }
                },
                pointer:{
                    width: 2,
                    length:'80%'
                },
                title : {
                    offsetCenter: [0, '-12%'],
                    textStyle: {fontSize: 8 }
                },
                detail : {
                    formatter:'{value}%',
                    offsetCenter: [0, '50%'],
                    textStyle: {fontSize: 10}
                },
                data:[{value: data.total.value, name: "声量趋势"}]
            },
            {
                name: '敏感趋势',
                type: 'gauge',
                center: ['80%', '60%'],
                radius: '60%',
                startAngle: 135,
                endAngle: -45,
                min: -100,
                max: 100,
                axisLine: {
                    lineStyle: {
                        width: 8,
                        color: [
                            [0.25, 'rgb(57,163,30)'],
                            [0.5, 'rgb(42,116,182)'],
                            [0.75, 'rgb(250,129,0)'],
                            [1, 'rgb(209,36,37)']
                        ]
                    } 
                },
                axisTick: {
                    splitNumber: 2
                },
                splitLine: {length: 8},
                axisLabel: {
                    distance: 0,
                    textStyle: {fontSize: 8 },
                    formatter: function(param){
                        if ((param % 50) == 0) {
                            return param
                        }
                    }
                },
                pointer:{
                    width: 2,
                    length:'80%'
                },
                title : {
                    offsetCenter: [0, '-12%'],
                    textStyle: {fontSize: 8 }
                },
                detail : {
                    formatter:'{value}%',
                    offsetCenter: [0, '50%'],
                    textStyle: {fontSize: 10}
                },
                data:[{value: data.negative.value, name: '敏感趋势'}]
            }
        ]
    };

    if(config.disableToolBox){
        delete option.toolbox
    }
    chart.clear()
    chart.setOption(option)
}

function drawRingChart(id, data, config){
    var chart = getChartInstance(id, config.theme)
    function wrapper_options(data, cfg){
        var opts = {
            tooltip: {
                trigger: 'item', 
                formatter:  function(d){return d.name + "<br/>" + tooltipMarkPoint(d) + numeral(d.value).format("0,0") + ": " + d.percent + "%"} 
            },
            toolbox: {show : true, feature : {dataView : {show: true, readOnly: false}, saveAsImage : {show: true} } },
            series: [{
                hoverAnimation: false,
                radius: ["30%", "55%"],
                name: cfg.label,
                type: 'pie',
                selectedMode: 'single',
                // roseType: "radius",
                selectedOffset: 10,
                clockwise: true,
                startAngle: 90,
                label: {
                    normal: {
                        formatter: "{b}\n{d}%",
                        textStyle: {
                            fontSize: 12
                        }
                    }
                },
                labelLine: {
                    normal: {
                        show: true,
                        // smooth: true,
                        length: 3,
                        length2: 10
                    }
                },
                data: data
            }]
        }
        if(config.isTendency && chart._theme.ted_color){
            var colors = []
            var ted_color = chart._theme.ted_color
            var theme_color = chart._theme.color
            data.forEach(function(d, idx){
                colors.push(ted_color[d.name] || theme_color[idx])
            })
            opts.color = colors
        }

        if(config.disableToolBox){
            delete opts.toolbox
        }

        return opts
    }
    var option = wrapper_options(data.sds, config)
    chart.clear()
    chart.setOption(option)

    chart.on('dataviewchanged', function(params){
        var opts = wrapper_options(params.newOption.series[0].data, this.cfg)
        chart.clear()
        chart.setOption(opts)
    }.bind({cfg: config}))
    chart.on("mousemove", function(e){
        var cursor = option.series[0].cursor
        if(window.event.altKey && cursor != "not-allowed"){
            option.series[0].cursor = "not-allowed"
        }
        else if(!window.event.altKey && cursor != "pointer"){
            option.series[0].cursor = "pointer"
        }
        if(option.series[0].cursor != cursor){
            chart.setOption(option)    
        }
    })
    chart.on("click", function(params){
        var key = params.data.name
        if(window.event.altKey) {
            observeChartFilter({key: key}, config, true);
        }
        else{
            observeChartFilter({key: key}, config)
        }
    })
}

function drawMapChart(id, data, config){
    var chart = getChartInstance(id, config.theme)
    var option = {
        tooltip: {trigger: 'item'},
        visualMap: { min: 0, max: data.max, left: 'left', top: 'bottom', text: ['高', '低'], calculable: false },
        toolbox: {show: true, left: 'right', top: 'top', feature: {dataView: {readOnly: false}, restore: {}, saveAsImage: {} } },
        series: [{
                name: config.title,
                type: 'map',
                mapType: 'china',
                roam: !!config.roam,    //缩放
                label: {normal: {show: false }, emphasis: {show: true } },
                data: data.data
            }
        ]
    }

    if(config.disableToolBox){
        delete option.toolbox
    }
    chart.clear()
    chart.setOption(option)
}

function randomData(){
    return parseInt(Math.random()*1000)
}

function getChartInstance(id, theme){
    var elem = document.getElementById(id)
    var chart = echarts.getInstanceByDom(elem)
    chart && chart.dispose()
    return echarts.init(elem, theme || "focuxy")
}

function normalizeTendency(ted){
    switch(ted) {
        case "Positive":
            return "正面"
        case "Neutral":
            return "中性"
        case "Negative":
            return "负面"
        case "一星负面":
            return "负面"
        case "二星负面":
            return "负面"
        case "三星负面":
            return "负面"
        case "危机":
            return "负面"
        default: 
            return ted
    }
}

var wrapper = {
    weiboType: function(type){
        switch (type) {
            case -1:
                return "普通用户";
            case 0:
                return "黄V";
            case 1:
            case 2:
            case 3:
            case 5:
            case 7:
                return "蓝V";
            case 200:
            case 210:
            case 220:
            case 230:
                return "达人";
            default :
                if(_.isNumber(type)){
                    return "普通用户";
                }
                return type;
        }
    },
    mediaType: function(media_type){
        if(global_mts && global_mts[media_type]){
            return global_mts[media_type]
        }
        switch(media_type) {
            case "web":
                return "网络"
            case "bbs":
                return "论坛"
            case "wechat":
                return "微信"
            case "app":
                return "手机"
            case "paper":
                return "平媒"
            case "microblog":
                return "微博"
            case "qa":
                return "问答"
            case "annc":
                return "公告"
            case "video":
                return "视频"
            case "rpt":
                return "日报"
            case "promot":
                return "促销"
            case "ec":
                return "环保"
            case "tax":
                return "税务"
            case "ciq":
                return "海关"
            case "judgement":
                return "司法文书"
            case "cs":
                return "证监会"
            case "cb":
                return "银监会"
            case "ci":
                return "保监会"
            default: 
                return media_type
        }
    }
}