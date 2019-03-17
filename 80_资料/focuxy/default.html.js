"use strict";

var stats_data = {}, shown = false
var ofd_xhr, render_slide, rendered = false
var cat_options = [], q_cats = []
var vueDatas = {
  mfc_rank: [{key: "宝马", value: 100, read: 100, comment: 100, negative: 100, positive: 100, normal: 100}],
  model_rank: [{key: "宝马", value: 100, read: 100, comment: 100, negative: 100, positive: 100, normal: 100}]
}

$(window).ready(function() {
  readCookie()
  cacheEles()
  initSidebar()
  initSearch()
  readQueryBody()
  resetSidebarActive()
  resetTabActive()
  observeFilter()
  initTheme()
  initNavTab()
  search()

  $(document).on('click', '#build-report', buildReport)
  $("#query-model").on("click", function(){
    $("#query_modal").modal({keyboard: false })
  })
  $("#beginSearch").on("click", buildKeyword)
});

function initNavTab(){
    var cat_names = nav_cats.map(function(o){return o.title})
    var App = new Vue({
        el: '#navgroup', 
        data: function(){
            return {
                checknavGroup: cat_options || ['全部'],
                cats: nav_cats
            }
        },
        methods: {
            handleCheckedCatsChange: function(e) {
              var cnt = e.target.defaultValue
              if(cnt == "全部"){
                if(!e.target.checked) {
                  this.checknavGroup.push(cnt)
                  return
                }
                this.checknavGroup = cat_names
              }
              else if(e.target.checked && this.checknavGroup.length == cat_names.length - 1 && this.checknavGroup.indexOf("全部") == -1){
                this.checknavGroup = cat_names
              }
              else if(!e.target.checked){
                if(this.checknavGroup.length == 0){
                  this.checknavGroup.push(cnt)
                  return
                }
                else if(this.checknavGroup.indexOf("全部") != -1){
                  this.checknavGroup.splice(this.checknavGroup.indexOf("全部"), 1)
                }
              }
              queryBody.cats = _.uniq(this.checknavGroup.map(function(title){
                return _.find(nav_cats, function(o){return o.title == title}).cat
              })).join(",")
              queryBody.page = 1
              // search()
            }
        }
    })
}

function resetTabActive(){
  var cats = typeof queryBody.cats == "string" ? _.without(queryBody.cats.split(/,/), "") : queryBody.cats
  cat_options = _.map(cats, function(c){
    var obj = _.find(nav_cats, function(o){return o.cat == c})
    obj && obj.cat && q_cats.push(obj.cat)
    return obj && obj.title
  })
  if(cat_options.indexOf("全部") !== -1 || cats.length == 0){
    cat_options = nav_cats.map(function(o){return o.title})
  }
  queryBody.cats = q_cats.join(",")
}

function initTheme(){
  $("#theme-select").css("height", "0px")
  $("#theme-select>.toggle-button").on("click", function(){
    var self = $(this)
    var parent = self.parent()
    var pele = parent[0]
    var deviation = getDeviation(!shown)
    parent.find("ul").css("display", shown ? "none": "block")
    parent.css("height", shown ? "0px" : "110px")
    var top = document.documentElement.scrollTop + document.documentElement.clientHeight - $("#theme-select")[0].offsetHeight
    parent.css("top", top + deviation)
    self.find("i").attr("class", "fa fa-chevron-" + (shown ? "up" : "down"))
    shown = !shown
  })

  $("#theme-select img").on("click", function(){
    var self = $(this)
    queryBody.theme = self.data("theme")
    var themeName = queryBody.theme
    return search()
    $("div[id^=chart-]").each(function(idx, ele){
      var chart = echarts.getInstanceByDom(ele)
      if(chart){
        var option = chart.getOption()
        chart.dispose()
        chart = echarts.init(ele, themeName)
        chart.clear()
        chart.setOption(option)
      }
    })
  })
}

function getDeviation(shown) {
  var userAgentInfo = navigator.userAgent
  var Agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"]
  var ispc = true
  for (var v = 0; v < Agents.length; v++) {
    if (userAgentInfo.indexOf(Agents[v]) > 0) {
      ispc = false;
      break;
    }
  }
  return shown ? (ispc ? -110 : -110): (ispc ? 0 : 0)
}

window.onscroll = window.onresize = function(){
  var ele = document.getElementById("theme-select")
  var deviation = getDeviation(shown)
  var top = document.documentElement.scrollTop + document.documentElement.clientHeight - ele.offsetHeight + deviation
  $(ele).css("top", top)
}

moment.locale("zh-cn");
var filter, filters;

function upload(){
    $.ajaxFileUpload({
        url: '/upload_arts',
        type: "post",
        secureuri: false,
        fileElementId: 'file',
        success: function(data, status){
            var str = $(data).find("body").text(),
                rst = $.parseJSON(str);
                
            $().toastmessage('showToast', {
                text: rst.msg || "上传成功",
                stayTime: 5000,
                sticky: false,
                position: 'top-right',
                type: rst.suc ? "success" : "error"
            });
        }
    });
}

function observeFilter() {
  filter = new Filter();
  filter.on('change', onChangeFilter);

  $('#newsList').on('click', '.searchable', function() {
    var ele = $(this);
    var ref = ele.attr('ref');
    var val = $.trim(ele.text());
    filter.add({key: ref, value: val });
  });
}

function observeChartFilter(item, config, must_not) {
  if (!filter) {
    return;
  }
  var field_name = config.ref_key || config.name
  var value_key = item.value || item.key
  var value_title = item.key
  var f = { key: field_name, label: config.label, value: value_key, value_title: value_title};
  if(must_not){
    f = _.extend({"must_not": true}, f);
  }
  filter.add(f);
}

function start_download(){
  if(ofd_xhr){
    return 
  }
  ofd_xhr = $.ajax({
    url: '/api/ofd',
    type: 'GET',
    dataType: 'json',
    data: queryBody,
    error: function(resp) {
      ofd_xhr = null;
      if (!(resp && resp.statusText == "abort")) {
        onSearchError('与服务器的链接失败，请稍候重试。');
      }
    },
    success: function(resp) {
      ofd_xhr = null;
      if (!resp) {
        return onSearchError('无法查询到相应数据。');
      }
      if (!resp.suc) {
        return onSearchError(resp.msg)
      }
      else{
        onSearchError("已加入离线下载, 任务名称: [" + resp.name + "]")
      }
    }
  })
  return false;
}

function onChangeFilter(_filters) {
  filters = [];
  _filters.forEach(function(f) {
    if (f.ban) {
      return;
    }
    var d = {
      key: f.key,
      value: f.value
    };
    if (f.must_not) {
      d.must_not = true;
    }
    filters.push(d);
  });

  queryBody.page = 0;
  search();
}

function initToggleChart(){
  $("div.report>div.title").on("click", function(){
    var self = $(this),
      parent = self.parent(),
      body = $("div.body", parent),
      icon = $("i:nth-child(2)", self);
      if(body.is(":visible")){
        body.slideUp(200, function() {
          body.css("display", "none");
          icon.removeClass("glyphicon-chevron-up").addClass('glyphicon-chevron-down')
        });
      }
      else{
        body.slideDown(200, function() {
          body.css("display", "block");
          icon.removeClass("glyphicon-chevron-down").addClass('glyphicon-chevron-up')
        });
      }
  })
}

function onSearchError(errMsg) {
  result_tips.html(tmps.exception({
    error: errMsg
  }));
  setTimeout(function(){
    result_tips.html("")
  }, 10000)
}

// search.
function search(_page) {
  var v = $.trim(q.val())
  if (xhr && xhr.readystate != 4) {
    xhr.abort()
    xhr = null
  }

  $('title').text((v || '空') + ' - ' + defaultTitle)
  v = v.replace(/（/g, "(")
      .replace(/）/g, ")")
      .replace(/[“”]/g, "\"")
      .replace(/(\s+and\s+)|(\s+or\s+)|(\s+not\s+)/g, function(p){
        return p.toUpperCase()
      })
  q.val(v)
  queryBody.q = v
  
  if(!queryBody.project && !v){
    return q.focus()
  }

  setHash()
  delete queryBody.cat
  filters && (queryBody.filters = encodeURIComponent(JSON.stringify(filters)));
  $('#ofd').attr('href', 'javascript:void(0)');
  queryBody.size = 10
  loader.show();

  if(category.createSlide)
   createSlide()
  
  $(".slick-next,.slick-prev").hide()
  xhr = $.ajax({
    url: '/async_search',
    type: 'GET',
    dataType: 'json',
    timeout: 30000,
    data: queryBody,
    error: function(resp) {
      xhr = null;
      loader.hide();
      if (!(resp && resp.statusText == "abort")) {
        onSearchError('与服务器的链接失败，请稍候重试。');
      }
    },
    success: function(resp) {
      xhr = null
      loader.hide()
      pagination.html('')
      delete queryBody.ia
      if (!resp) {
        return onSearchError('无法查询到相应数据。');
      }
      if (resp.error) {
        return onSearchError(resp.error)
      }

      $("#results").css("display", "block")
      if (resp.hits && resp.hits.hits && resp.hits.hits.length > 0) {
        var hits = resp.hits;
        if (hits.total == 0) {
          // no data.
          results.html(tmps.nodata({
            q: q.val()
          }));
        } else {
          // has data.
          hits.took = fromNow(resp.took || 0);
          var _hits = [],
            sortFn = queryBody.order == 'created' ? function(x, y) {
              return moment(y._source.created, ['YYYY-MM-DD HH:mm:ss Z']).valueOf() - moment(x._source.created, ['YYYY-MM-DD HH:mm:ss Z']).valueOf();
            } : function(x, y) {
              return -x._score + y._score;
            };

          hits.hits = hits.hits.sort(sortFn);
          var qs = "";
          for(var key in queryBody){
            qs += ("&" + key + "=" + encodeURIComponent(queryBody[key]))
          }
          hits.download_link = qs.substr(1);
          hits.cn = queryBody.cn;
          hits.hits.forEach(function(hit){
            hit._source.mt_name = wrapper.mediaType(hit._source.media_type);
          })
          queryBody.total_count = hits.total
          hits.page = parseInt(queryBody.page);
          hits.page_size = parseInt(queryBody.size);

          renderContent(hits)
          render_DocsList(hits)
          $('#ofd').on('click', function(){
            confirm("提示", "确定要进行离线下载吗？", "info", function(sure){
              if(sure){
                start_download()
              }
            })
          });

          drawPagination(resp.hits.total, 5)
          $("#download_ppt").on("click", function(){
            downloadPptx.call({topics: this.topics})
          }.bind({topics: resp.aggregations.raw_title.buckets}))
        }
      } else {
        renderContent({total: 0, hits: [] });
      }

      if(resp.aggregations){ 
        var themeName = queryBody.theme || default_theme || "theme5"
        var range = {from: moment().startOf("day").valueOf(), to: moment().endOf("day").valueOf()}
        if(resp.range) {
          range = resp.range
        }
        if(!rendered) {
          var containerWidth = $(".container").innerWidth()
          chart_configs.forEach(function(cfg){
            var data = resp.aggregations[cfg.name]
            if(data){
              if(cfg.type == "newsList"){
                render_newsList(cfg, data)
              }
              else if(cfg.type == "dataTable"){
                var table_html = '<el-table :data="'+ cfg.dataSource +'" height="'+ cfg.height +'" border style="margin-top: 1px">'
                cfg.columns.forEach(function(col){
                  table_html += '<el-table-column prop="' + col.key + '" label="'+ col.label +'" width="'+ col.width +'"></el-table-column>'
                })
                table_html+= '</el-table>'
                cfg.html = '<el-col :span="' + (cfg.span || '') + '" style="' + (cfg.cstyle || '') + '}">\
                    <el-card class="box-card">\
                      <div class="report ' + (cfg.className || '') + '}">\
                        <div class="title">\
                          <i class="fa '+ (cfg.icon || 'fa-list') +'"></i>\
                          <span>'+ cfg.label +'</span>\
                        </div>\
                        <div class="body" id="chart-'+ cfg.id +'" style="width:'+ cfg.width +'px;height:'+ cfg.height || 300 +'px;">\
                          '+ table_html +'\
                        </div>\
                      </div>\
                    </el-card>\
                  </el-col>';
                if($("chart-" + cfg.id).size() == 0){
                  var parent = $("#" + (cfg.parent || "charts"))
                  $(cfg.html).appendTo(parent)
                }
              }
              else {
                  cfg.html = '<el-col :span="'+ (cfg.span || '') +'" style="'+ (cfg.cstyle || '') +'">\
                    <el-card class="box-card">\
                      <div class="report '+ (cfg.className || '') +'">\
                        <div class="title">\
                          <i class="fa '+ (cfg.icon || 'fa-list') +'"></i>\
                          <span>'+ cfg.label +'</span>\
                        </div>\
                        <div class="body" id="chart-'+ cfg.id +'" style="width:'+ cfg.width +'px;height:'+ (cfg.height || 300) +'px;">\
                        </div>\
                      </div>\
                    </el-card>\
                  </el-col>'
                  if($('chart-' + cfg.id).size() == 0){
                    var parent = $('#' + (cfg.parent || 'charts'))
                    $(cfg.html).appendTo(parent)
                  }
              }
              if(cfg.type == 'stackBar'){
                cfg.normalize = !(!!queryBody.project && !!queryBody.customer)
              }
            }
            cfg.theme = themeName
          });
          $('.fullSlide').show()
          new Vue({
            el: '#charts',
            data: vueDatas
          })
          var slide = $('.fullSlide')
          if(slide.size() > 0){
            slide.find('.report .body').css('width', slide.width() - 30 + 'px').css('height', '320px')
          }
          rendered = true
        }
        
        render_charts(chart_configs, resp.aggregations, range )
        $('.fullSlide').slide({titCell : '.hd ul', mainCell: '.bd ul', effect: 'left', vis: 'auto', autoPlay: false, autoPage: true, trigger: 'click'})
      }
    }
  })
}

function render_charts(chart_configs, datas, range) {
  chart_configs.forEach(function(cfg) {
    cfg.theme = queryBody.theme
    var data = datas[cfg.name]
    if(cfg.type == "wordcloud"){
      var words = [], sds = [];
      data.buckets.forEach(function(bucket) {
        if(!/^\d+$/.test(bucket.key) && bucket.key.length > 1 && queryBody.q.indexOf(bucket.key) == -1){
          words.push(bucket)
          sds.push(bucket)
        }
      })
      stats_data[cfg.id] = sds
      data = words
      cfg.click = wordcloud_click
    }
    else if(cfg.type == "newsList"){
      render_newsList(cfg, data)
    }
    else if(/gauge/i.test(cfg.type)){
      data = process_dataTrend(data, range)
    }
    else if(["mfc_rank", "model_rank"].indexOf(cfg.name) != -1){
      var dataList = []
      data.buckets.forEach(function(bucket){
        var item = {key: bucket.key, value: bucket.doc_count, read: bucket.read.value, comment: bucket.comment.value, negative: 0, positive: 0, normal: 0 }
        bucket.tendency.buckets.forEach(function(b){
          switch(b.key) {
            case "正面":
              item.positive = b.doc_count
              item.idx = 0
              break;
            case "负面":
              item.negative = b.doc_count
              item.idx = 2
              break;
            case "中性":
              item.normal = b.doc_count
              item.idx = 1
              break;
          }
        })
        dataList.push(item)
      })
      vueDatas[cfg.name] = dataList
    }
    stats_data[cfg.id] = data
    if(cfg.type == "multiLine") {
      if(cfg.seriesKey){
        data.buckets.forEach(function(bucket){
          var bkts = [], st, ed
          if(typeof range.from === "number"){
            st = moment(range.from)
            ed = moment(range.to)
          }
          else {
            st = moment(range.from, ["YYYY/MM/DD HH:mm:ss Z"])
            ed = moment(range.to, ["YYYY/MM/DD HH:mm:ss Z"])
          }

          while(st < ed){
            // var key = st.startOf("day").valueOf()
            var date = st.startOf("day").format("YYYY/MM/DD")
            var key_as_string = st.startOf("day").format("YYYY/MM/DD HH:mm:ss Z")
            var b = _.find(bucket[cfg.seriesKey].buckets, function(o){return o.key_as_string.indexOf(date) >= 0 })
            if(b){
              b.key_as_string = b.key_as_string.replace("+0000", "+08:00")
            }
            bkts.push(b || {key_as_string: key_as_string, key: st.startOf("day").valueOf(), doc_count: 0})
            st.add(1, "days")
          }
          bucket[cfg.seriesKey].buckets = bkts
        })
      }
    }

    cfg.range = range
    if(cfg.type != "newsList"){
      drawChart(data, cfg)
    }
  })
}

function buildReport(){
  var datas = {}
  chart_configs.forEach(function(cfg) {
    var cache_data = stats_data[cfg.id]
    var ds = null
    if(cfg.type == "newsList"){
      ds = _.chain(cache_data.buckets).map(function(o){
        if(o.hits.hits.hits.length == 0){
          return null
        }
        var hit = o.hits.hits.hits[0]
        hit._source.rank = o.ranks.value
        return hit._source
      }).filter(function(o){
        return o
      }).value()
    }
    else{
      ds = prepareData(cache_data, cfg)
    }
    datas[cfg.id] = {
      label: cfg.label,
      type: cfg.type,
      data: ds
    }
  })
  buildOnlineReport(datas)
}

function downloadPptx() {
  var pptx = new PptxGenJS()
  pptx.setAuthor("rick jose")
  pptx.setCompany("beyondlink Ltd.")
  pptx.setRevision("1")
  pptx.setSubject("Annual Report")
  pptx.setTitle("PptxGenJS Sample Presentation")
  pptx.setLayout({ name:"A3", width: 16, height: 9 })

  var g_options = {
    title: { color:"3D3D3D", marginPt: 3, border:[0, 0, {pt:"1", color:"CFCFCF"}, 0]},
    titleLayout: {x: 0.75, y: 0.25, w: 14.5, h: 0.7, align: "l", fontSize: 32},
    chartLayout: {x: 0.75, y: 1.0, w: 14.5, h: 7.5, showValue: true, showLegend: true, legendFontSize: 14, legendPos: "b", titleFontSize: 24, showTitle: true} }
  var topics = this.topics
  async.waterfall([
      function(done) {
        var tps = _.map(topics, function(o) {
          var t = _.pick(o.hits.hits.hits[0]._source, "body", "media", "channel", "created", "mt_name", "title", "uri")
          t.total = o.doc_count
          o.hits.hits.hits[0]._source.total_rank && (t.total_rank = o.hits.hits.hits[0]._source.total_rank)
          return t
        })
        if(tps.length > 0) {
          var tabOpts = { x: 1, y: 0.95, w: 14.5, rowH: 0.5, h: 9.7, colW:[2.5, 8, 2, 2], color: "3D3D3D", font_size: 16, border:{ pt: 1, color: "CCCCCC"}, align: "l", valign: "m" };
          var arrRows = []
          tps.forEach(function(topic) {
            arrRows.push([
                {text: topic.media, options:{align: "center", valign: "middle"}}, 
                {
                  text: topic.title,
                  options: { hyperlink:{ url:topic.uri || topic.url, tooltip:'原文' } }
                }, 
                topic.created.substr(0, 19),
                topic.total + "条相似"
            ])

            if(arrRows.length == 10){
              var slide = pptx.addNewSlide()
              slide.addTable([[{text:'热门话题', options: g_options.title }]], g_options.titleLayout)
              slide.addTable(arrRows, { x: 0.5, y: 0.95, w: 14.5, rowH: 0.75, h: 9.7, colW: [2.5, 8, 2.5, 1.5], color: "3D3D3D", font_size: 16, border:{pt: 1, color: "CCCCCC"}, align: "l", valign: "m" })
              arrRows = []
            } 
          });
          if(arrRows.length > 0){
            var slide = pptx.addNewSlide()
            slide.addTable([[{text:'热门话题', options: g_options.title }]], g_options.titleLayout)
            slide.addTable(arrRows, { x: 0.5, y: 0.95, w: 14.5, rowH: 0.75, h: 9.7, colW:[2.5, 8, 2.5, 1.5], color: "3D3D3D", font_size: 16, border:{ pt: 1, color: "CCCCCC"}, align: "l", valign: "m" })
          }
          done()
        }
      },
      function(done) {
        chart_configs.forEach(function(o) {
          if(o.type == "wordcloud" || o.type == "multiGauge") {
            var canvas = $("#chart-" + o.id +" canvas")[0]
            if(canvas) {
              var img_path = canvas.toDataURL("image/png", 1)
              if(img_path){
                var slide = pptx.addNewSlide()
                slide.addTable([[{text: o.label, options: g_options.title }]], g_options.titleLayout)
                var w = 14.5, h = 7.5
                if(o.aspect_ratio) {
                  slide.addImage(_.extend({x: (w - h/o.aspect_ratio)/2 + 0.75, y: 1, w: h/o.aspect_ratio, h: h, data: img_path}, o.opts))
                }
                else{
                  slide.addImage(_.extend({x: 0.75, y: 1, w: w, h: h, data: img_path}, o.opts))  
                }
              }
            }
          }
        })
        done()
      },
      function(done) {
        var ignore_types = ["wordcloud", "multiGauge", "newsList"]
        chart_configs.forEach(function(o) {
          if(_.indexOf(ignore_types, o.type) != -1) {
            return
          }
          renderPPTChart(pptx, g_options, o, stats_data[o.id])
        })
        done()
      }
    ], function(err){
      pptx.save("data-report")
    })
}

function renderPPTChart(pptx, opts, cfg, data){
  var slide = pptx.addNewSlide()
  var ds = prepareData(data, cfg)
  if(/bar/i.test(cfg.type)){
    var cds = _.map(ds.sds, function(d){return {name: d.name, labels: ds.yds, values: d.data }})
    slide.addChart(pptx.charts.BAR, cds, _.extend({barGrouping: "stacked", title: cfg.label, barDir: 'bar', valueBarColors: true, chartColors: _.map([1, 2, 3, 4, 5, 6], function(i){return pptx.colors["ACCENT" + i]}), invertedColors: ["B45050"] }, opts.chartLayout)); 
  }
  else if(/line/i.test(cfg.type)){
    var cds = _.map(ds.series, function(d){return {name: d.name, labels: ds.xds, values: d.data } })
    slide.addChart(pptx.charts.LINE, cds, _.extend({lineSize: 2, title: cfg.label, chartColors: _.map([1, 2, 3, 4, 5, 6], function(i){return pptx.colors["ACCENT" + i]}) }, opts.chartLayout));
  }
  else if(/ring/i.test(cfg.type)){
    var cds = [{name: cfg.label, labels: _.map(ds.sds, function(d){return d.name}), values: _.map(ds.sds, function(d){return d.value}) }]
    slide.addChart(pptx.charts.DOUGHNUT, cds, _.extend({holeSize: 50, showLabel: true, title: cfg.label, valueBarColors: true, chartColors: _.map([1, 2, 3, 4, 5, 6], function(i){return pptx.colors["ACCENT" + i]}) }, opts.chartLayout));
  }
}

function confirm(title, text, type, next){
  // type danger、info、warning
  BootstrapDialog.confirm({
    title: title || ' ⚠ 警告',
    message: text || '删除操作不可恢复，确定要删除吗？',
    type: BootstrapDialog['TYPE_' + type.toUpperCase()],
    closable: true,
    draggable: true,
    btnCancelLabel: '取消',
    btnOKLabel: '确定',
    btnOKClass: 'btn-' + type,
    callback: next
  })
}

function createSlide() {
  if(!render_slide){
    var container = $("#crow-1")
    var html = '<el-col span=12 class="fullSlide" style="display:none;padding-right: 3px;">\
      <div class="bd">\
        <ul>\
          <li><div id="cloud1"></div></li>\
          <li><div id="cloud2"></div></li>\
        </ul>\
      </div>\
      <div class="hd"><ul></ul></div>\
      <a class="prev" href="javascript:void(0)"></a>\
      <a class="next" href="javascript:void(0)"></a>\
    </el-col>'
    $(html).appendTo(container)
    render_slide = true
  }
}

function wrap_mediaTypeName(media_type){
  switch(media_type) {
    case "web":
      return "网络新闻"
    case "bbs":
      return "论坛"
    case "wechat":
      return "微信"
    case "app":
      return "手机新闻"
    case "paper":
      return "报纸"
    case "microblog":
      return "微博"
    case "qa":
      return "问答"
    case "annc":
      return "公告"
    case "video":
      return "视频"
    default: 
      return media_type
  }
}

function wordcloud_click(item){
  q.val(q.val()+ " " + item.name)
  search()
}

function buildKeyword(){
  var kwOpts = [{id: "txt_keyws_1", op: "+"}, {id: "txt_keyws_2", op: "+"}, {id: "txt_keyws_3", op: "-"}];
  var keepBlank = $("#cb-keepblank").is(":checked")
  kwOpts.forEach(function(o){
    var v = $("#" + o.id).val().replace(/\t/g, " ").replace(/ {2,}/g, " ").trim()
    v && (o.keywords = keepBlank ? v.split(/[\n,，]/g) : v.split(/[\s,，]/g))
    o.keywords && (o.keywords = _.without(o.keywords, ""))
  })

  var keywords = []
  kwOpts.forEach(function(o){
    o.keywords && keywords.push(o.op + '("' + o.keywords.join('" "') + '")')  
  })
  var v = keywords.length > 1 ? keywords.join(' AND '): keywords.join("")
  if (/[\+-]/.test(v)) {
    v = v.replace(/([\+-]).*?\(/g, function(k, s) {
      return s + (queryBody.term == "title" ? "title:" : "") + "("
    })
    q.val(v)
  }
  q.val(v)
  search()
}

function process_dataTrend(data, range) {
  var total_count = 0
  var today = moment().format("YYYY/MM/DD")
  var emotions_score = [{key: "正面", score: 1}, {key: "负面", score: -1}, {key: "中性", score: 0}]
  var emotions = [{title: "正面", key: "positive", total: 0}, {title: "负面", key: "negative", total: 0}, {title: "中性", key: "normal", total: 0} ]
  var from = typeof range.from === "string" ? moment(range.from, ["YYYY/MM/DD"]): moment(range.from)
  var to = typeof range.to === "string" ? moment(range.to, ["YYYY/MM/DD"]): moment(range.to)

  var ignore_lastday = to.format("YYYY/MM/DD") == today

  var date_count = to.diff(from, 'days')
  if(!ignore_lastday){
    date_count++
  }
  data.buckets.forEach(function(bucket) {
    var ds = typeof range.from === "string" ? moment(range.from, ["YYYY/MM/DD"]).startOf("day"): moment(range.from).startOf("day")
    var dt = typeof range.to === "string" ? moment(range.to, ["YYYY/MM/DD"]) : moment(range.to).startOf("day")
    if(ignore_lastday){
      dt.add(-1, "days")
    }

    var sc = _.find(emotions_score, function(o){return o.key == bucket.key})
    var emt_key = !sc ? "normal": (sc.score > 0 ? "positive": (sc.score < 0 ? "negative": "normal"))
    var emt_obj = _.find(emotions, function(o){return o.key == emt_key})
    while(ds <= dt) {
      var c_date = ds.format("YYYY/MM/DD")
      var bkt = _.find(bucket.time_line.buckets, function(b){return b.key_as_string.indexOf(c_date) == 0})
      if(bkt) {
        emt_obj.total += bkt.doc_count
        total_count += bkt.doc_count
      }
      if(dt.diff(ds, 'days') == 0){
        emt_obj.latest = bkt ? bkt.doc_count : 0
      }
      ds.add(1, "days")
    }
  })
  var total = {
    title: "声量", 
    key: "total", 
    total: total_count, 
    latest: _.reduce(emotions, function(s, o){ return s += (o.latest || 0) }, 0)
  }
  emotions.push(total)
  emotions.forEach(function(o){
    var avg = o.total / date_count
    o.value = avg ? ((o.latest - avg) / avg * 100).toFixed(2) : 0
  })
  var emt_ne = _.find(emotions, function(o){return o.key == "negative"})
  if(emt_ne){
    emotions.push({
      title: "敏感占比", 
      key: "negative_rate", 
      value: total.total == 0 ? 0 : (emt_ne.total / total.total * 100).toFixed(2), 
      min: 0, max: 100 
    })
  }
  
  var rst = _.filter(emotions, function(o) {
    return !/(正面)|(中性)/.test(o.title)  //o.title.indexOf("正面") == -1 && o.title.indexOf("中性") == -1
  })
  return rst
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