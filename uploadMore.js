/*!
 * @Title: uploadMore
 * @Version: 1.2
 * @Description：文件/图片上传组件,预览
 * @Author: GuoZhaoXuan
 * @License：Apache License 2.0
 */
layui.define(['upload', 'layer', 'sortable'], function (exports) {
    var $ = layui.jquery, upload = layui.upload, layer = layui.layer, Sortable = layui.sortable;
    /**
     * 绑定事件的模块名
     *
     * @type {string}
     */
    var MOD_NAME = 'uploadMore';

    /**
     * 构造方法
     *
     * @param options
     */
    var uploadMore = function (options) {
        var that = this;
        // 初始化配置
        that.initOption(options);
        that.init(); // 初始化
    };

    /** 初始化 */
    uploadMore.prototype.init = function () {
        var that = this;
        that.initAttrs();
        // 先清空
        this.delete();
        // 嵌入css
        $.ajax({
            url: layui.cache.modules[MOD_NAME].replace('.js', '.css'), async: false, success: function (res) {
                $('head').append('<style id="' + MOD_NAME + '-css">' + res + '</style>');
            },
        });
        // 渲染上传按钮
        that.renderUploadBtn();
        // 绑定事件
        this.bindEvents();
        // 初始化成员信息
        that.renderInitValue();
        return this;
    };

    /**
     *
     * 初始化配置
     *
     * @param options
     * @returns {uploadMore}
     */
    uploadMore.prototype.initOption = function (options) {
        var that = this;
        that.options = $.extend(true, {
            elem: null, //容器对象
            maxNum: 5, // 限制最多数量 0 无限制
            concurrencyMaxNum: 0,// 并发处理数 0无限制
            // 上传按钮状态: 1.一直显示(默认)  2.没有成员时显示 3.隐藏
            uploadBtnStatus: 1,
            // 操作按钮
            operation: {
                update: true,
                preview: true,
                delete: true,
            },
            // 样式
            style: {
                size: 120, // 尺寸
            },
            upload: {
                // 上传配置，组件 upload
                drag: true, // 默认排序
            },
            // 参考组件 sortable, false 则无排序
            sortable: {},
            // 初始化数据
            initValue: [],
            parseData: function (res) {
                return {
                    code: res.code, // 状态码（此处按0成功）
                    message: res.msg || '', // 返回信息
                    fileInfo: (res.data && res.data.info) ? res.data.info : {}, // 文件完整信息
                    url: (res.data && res.data.info) ? res.data.info.url : '', // 文件地址
                    mimeType: (res.data && res.data.info) ? res.data.info.mimeType : 'image/jpeg',
                };
            },
            on: {
                /**
                 * 添加成员回调
                 *
                 * @param itemInfo
                 * @param obj+
                 */
                add: function (itemInfo, obj) {
                },
                /**
                 * 删除成员回调
                 *
                 * @param itemInfo
                 * @param obj
                 */
                del: function (itemInfo, obj) {
                },
                /**
                 * 上传成功回调
                 *
                 * @param itemInfo 成员信息
                 * @param obj
                 */
                success: function (itemInfo, obj) {
                },
                /**
                 * 上传失败回调
                 *
                 * @param errorMsg 错误信息
                 * @param itemInfo 成员信息
                 * @param obj
                 */
                error: function (itemInfo, obj, errorMsg) {
                    // obj.getItem(index);
                },
            },
        }, options);
        return this;
    };

    /**
     * 初始化属性
     */
    uploadMore.prototype.initAttrs = function () {
        // 容器对象
        this.container = $(this.options.elem);
        this.container.addClass('uploadMore-container');
        // 上传按钮
        this.uploadBtn = null;
        this.index = 0; // 当前元素下标
        // 排序对象
        this.sortable = null;
        // 上传对象
        this.upload = null;
        // 成员信息
        this.items = {
            // 文件下标:{文件信息}
            /*1: {
                      elem: null, // 成员dom
                      fileInfo: {},// 文件信息
                      url: '',// 文件地址
                      progress: null, // 进度条实例
                      isShowAction: false, // 是否展示操作按钮
                      sort:0, // 排序值
                      isSuccess:false,// 是否上传成功
                      isRetry: false,// 是否为重新上传
                      status:1, // 状态: 1.待处理 2.上传中 3.上传失败 4.上传成功
                  }*/
        };

        // 队列信息
        this.waitWork = []; // 待处理文件
        this.queueWork = [];
        this.queueWorkLock = false;
        this.queueWorkKey = 0;
        this.queueWorkStatusNum = 0;


        return this;
    };

    /**
     * 初始化默认成员值
     */
    uploadMore.prototype.renderInitValue = function () {
        var that = this;

        if (that.options.initValue) {
            layui.each(that.options.initValue, function (i, v) {
                v = layui.type(v) === 'object' ? v : {url: v};
                var urlInfo = layui.url(v.url);
                var index = that.addItem(null, {
                    name: urlInfo.pathname[urlInfo.pathname.length - 1], type: uploadMoreObj.getMimeTypeByFile(v.url),
                });
                that.successProgress(index, v);
            });
            that.resetSort();
        }
    };

    /** 绑定各项事件 */
    uploadMore.prototype.bindEvents = function () {
        var that = this;
        // 上传按钮绑定事件
        that.bindUpload();
        // 拖拽排序按钮
        that.bindSortable();

        // 上传按钮上传
        that.container.delegate('.uploadMore-uploadBtn', 'click', function () {
            that.container.find('.uploadMore-uploadInput').trigger('click');
        });

        // 拖拽上传
        if (that.options.upload.drag) {
            that.container.delegate('.uploadMore-uploadBtn', 'dragover', function (e) {
                e.preventDefault();
                that.container.find('.uploadMore-uploadInput').trigger('upload.over');
            });

            that.container.delegate('.uploadMore-uploadBtn', 'dragleave', function (e) {
                e.preventDefault();
                that.container.find('.uploadMore-uploadInput').trigger('upload.leave');
            });

            that.container.delegate('.uploadMore-uploadBtn', 'drop', function (e) {
                e.preventDefault();
                that.container.find('.uploadMore-uploadInput').trigger('upload.drop', e);
            });
        }

        // 蒙版展示切换
        that.container.delegate('.uploadMore-item', 'mouseenter mousemove', function (e) {
            layui.stope(e);
            // 显示蒙版
            var index = $(this).data('index');
            if (that.getItemInfo(index).isShowAction) {
                $(this).find('.uploadMore-operation').removeClass('layui-hide').animate({opacity: 0.8}, 200);
            }
        });
        that.container.delegate('.uploadMore-item', 'mouseleave', function (e) {
            layui.stope(e);
            // 隐藏蒙版
            $(this).find('.uploadMore-operation').addClass('layui-hide').css({
                opacity: 0,
            });
        });


        // 删除按钮事件
        that.container.delegate('.uploadMore-operation-action-delete', 'click', function (e) {
            layui.stope(e);
            that.removeItem($(this).parents('.uploadMore-item:eq(0)').data('index'));
            if (that.getCurrentNum(false) < 1) {
                // 无数据时显示上传按钮
                if (that.options.uploadBtnStatus === 2) {
                    that.uploadBtn.removeClass('layui-hide');
                }
            }
        });
        // 文件预览
        that.container.delegate('.uploadMore-operation-action-preview', 'click', function (e) {
            layui.stope(e);
            var item = $(this).parents('.uploadMore-item:eq(0)');
            // 图片预览
            if (item.find('.uploadMore-file').hasClass('uploadMore-img-preview')) {
                var imgIndex = 0;
                // 过滤成功成员
                that.getAllItem().filter('[data-is-success="true"]').each(function () {
                    if ($(this).find('.uploadMore-file').hasClass('uploadMore-img-preview')) {
                        if ($(this).is(item)) {
                            return false;
                        } else {
                            imgIndex++;
                        }
                    }
                });
                that.previewImage(imgIndex);
            }
        });
        // 编辑图片
        that.container.delegate('.uploadMore-operation-action-edit', 'click', function (e) {
            layui.stope(e);
        });
        // 信息提示
        that.container.delegate('[uploadMore-tips]', 'mouseenter', function (e) {
            layui.layer.tips($(this).attr('uploadMore-tips'), this);
        });

        return that;
    };

    /**
     * 渲染上传按钮
     */
    uploadMore.prototype.renderUploadBtn = function () {
        var that = this;
        that.uploadBtn = that.getUploadBtnTpl();
        that.container.append('<div class="layui-hide"><input type="hidden" class="uploadMore-uploadInput"></div>');
        that.container.append(that.uploadBtn);

        // 隐藏上传按钮
        if (that.options.uploadBtnStatus === 3) {
            that.switchUploadBtnStatus(true);
        }
    };

    /**
     * 渲染上传能力
     */
    uploadMore.prototype.bindUpload = function () {
        var that = this;
        // 总上传按钮操作
        that.upload = upload.render($.extend({}, that.options.upload, that.getUploadCommonConfig(1), {
            elem: $(this.container).find('.uploadMore-uploadInput:eq(0)'), // 同时上传文件数(multiple:true)
            number: this.options.maxNum > 0 ? this.options.maxNum : null, // 是否支持多文件
            multiple: true, unified: false,
        }));
    };

    /**
     * 绑定排序能力
     */
    uploadMore.prototype.bindSortable = function () {
        var that = this;
        if (that.options.sortable !== false) {
            that.sortable = new Sortable(that.container[0], $.extend(that.options.sortable, {
                swapThreshold: 1, animation: 150, handle: '.uploadMore-drag', // 设置触发排序区域元素
                draggable: '.uploadMore-item', // 允许排序类名
                // 列表内元素顺序更新的时候触发
                onEnd: function (/**Event*/ evt) {
                    // same properties as onEnd
                    that.resetSort();
                },
            }));
        }
    };

    /**
     * 获取文件下标
     *
     * @param index
     * @returns {null|number}
     */
    uploadMore.prototype.getIndex = function (index = null) {
        return index ? index : ++this.index;
    };

    /**
     * 添加成员
     *
     * @param index 成员下标
     * @param file  文件对象
     * @param sortIndex 排序成员下标
     * @param obj 文件操作对象
     * @returns {number|null}
     */
    uploadMore.prototype.addItem = function (index = null, file = null, sortIndex = null, obj = null) {
        var that = this;
        index = that.getIndex(index);
        // 初始化成员信息
        that.items[index] = {
            index: index, // 下标
            url: '', // 文件地址
            fileInfo: null, // 文件信息
            file: file, // 文件对象
            isShowAction: false, // 是否展示操作按钮
            mimeType: file ? file.type : null, // mime类型
            sort: 0, // 排序值
            isSuccess: false, // 是否上传成功
            status: 1, isRetry: false,
        };
        var itemTpl = that.getItemTpl(index);
        if (!sortIndex) {
            that.uploadBtn.before(itemTpl);
        } else {
            // 有成员排序则是编辑操作
            that.getItem(sortIndex).before(itemTpl);
            that.getItem(sortIndex).remove();
        }
        // 渲染进度条
        var progressFilterName = that.getProgressFilterName(index);
        layui.element.render('progress', progressFilterName);
        // 初始化成员信息
        that.setItemInfo(index, {
            elem: itemTpl, progress: progressFilterName,// 进度条
            upload: that.bindUploadByItem(index),// 绑定单文件操作对象
        });

        that.getCurrentNum(); // 更新当前数量
        that.resetSort(); // 重置排序
        // 切换上传按钮限制
        if (!this.isAllowAdd()) {
            that.switchUploadStatus(true);
        }
        that.updateStatus(index, 1);
        // 错误消息
        that.getItem(index).find('.uploadMore-error').unbind('mouseenter').bind('mouseenter', function () {
            layui.layer.tips($(this).attr('data-tips'), this);
        });

        // 重新上传
        that.getItem(index).find('.uploadMore-retryUpload').unbind('click').bind('click', function () {
            // 重置状态信息
            that.resetItem(index);
            that.setItemInfo(index, {
                isRetry: true,
            })
            // 重新上传
            obj.upload(index, file);
        });

        // 隐藏上传按钮
        if (that.options.uploadBtnStatus === 2) {
            that.switchUploadBtnStatus(true);
        }
        if (obj) {
            that.pushWaitWork({
                index: index, obj: obj, file: file,
            });
        }

        // 执行回调
        if (that.options.on.add) {
            that.options.on.add(that.getItemInfo(index), that);
        }

        return index;
    };

    /**
     * 删除成员
     *
     * @param index 下标
     */
    uploadMore.prototype.removeItem = function (index) {
        var that = this;
        that.getItem(index).remove();
        var item = that.getItemInfo(index);
        that.delItemInfo(index); // 移除成员信息
        that.getCurrentNum(); // 更新当前数
        that.resetSort(); // 重置排序
        if (this.isAllowAdd()) {
            that.switchUploadStatus(false);
        }
        // 执行回调
        if (that.options.on.del) {
            that.options.on.del(item, that);
        }
    };
    /**
     * 获取成员
     *
     * @param index
     * @returns {*}
     */
    uploadMore.prototype.getItem = function (index) {
        return this.container.find('.uploadMore-item[data-index=' + index + ']');
    };

    /**
     * 重置信息
     *
     * @param index
     */
    uploadMore.prototype.resetItem = function (index) {
        var that = this;
        // 隐藏错误信息
        that.getItem(index).find('.uploadMore-message').addClass('layui-hide');
        // 隐藏进度条
        that.getProgressIns(index).addClass('layui-hide');
    };

    /**
     * 获取所有的item
     *
     * @returns {*}
     */
    uploadMore.prototype.getAllItem = function () {
        return this.container.find('.uploadMore-item');
    };

    /**
     * 成员中编辑上传操作
     *
     * @param index
     * @returns {*}
     */
    uploadMore.prototype.bindUploadByItem = function (index) {
        var that = this;
        // 单文件编辑
        return upload.render($.extend({}, that.options.upload, that.getUploadCommonConfig(2, index), {
            elem: that.getItem(index).find('.uploadMore-operation-action-edit')[0], // 是否支持多文件
            multiple: false,
        }));
    };

    /**
     * 获取上传公共配置
     *
     * @param type 1.总上传按钮 2.成员编辑
     * @param itemIndex type==2时 的成员下标
     * @returns {{before: before, progress: progress, choose: choose, done: done}}
     */
    uploadMore.prototype.getUploadCommonConfig = function (type = 1, itemIndex = null) {
        var that = this;
        return {
            auto: false, // 不自动上传
            //**************** 跳过内部校验/组件接管校验 start **********
            /*  accept: 'file',// images 图片类型(默认) file 所有文件类型 video 视频类型 audio 音频类型
                    acceptMime: '*', // MIME 类型限制
                    exts: '*', // 允许上传的文件后缀。一般结合 accept 属性来设定。
                    size: 0, // 不限制文件大小*/
            //**************** 跳过内部校验/组件接管校验 end **********
            // 选择文件时
            choose: function (obj) {
                that.choose(obj, type, itemIndex);
            }, // 进度
            progress: function (n, elem, res, currentIndex) {
                // 改变进度
                that.updateStatus(currentIndex, 2);
                that.changeProgress(currentIndex, n);
            }, // 上传前
            before: function (obj) {
            }, // 上传完成
            done: function (res, currentIndex, upload) {
                that.done(currentIndex, res);
            }, // 上传失败
            error: function (currentIndex, upload) {

                that.done(currentIndex, null);
            }
        };
    };


    /**
     * 触发上传队列任务
     *
     * @param key
     */
    uploadMore.prototype.triggerQueueWork = function (key) {
        var that = this;
        if (!that.queueWorkLock) {
            that.queueWorkStatusNum = 0;
            if (that.queueWork[key]) {
                that.queueWorkLock = true;
                layui.each(that.queueWork[key], function (index, item) {
                    item.obj.upload(item.index, item.file);
                });
                // delete that.queueWork[key];
            }
            that.queueWorkLock = false;
        }
    };
    /**
     * 文件校验(单文件)
     */
    uploadMore.prototype.checkFile = function (file) {
        var that = this;
        // 验证 accept
        if (!that.checkAccept(file)) {
            console.log('类型校验错误');
            return false;
        }
        // 验证文件大小
        if (!that.checkSize(file)) {
            console.log('大小校验错误');
            return false;
        }
        return true;
    };
    /**
     * 校验文件类型
     *
     * @param file
     * @returns {boolean}
     */
    uploadMore.prototype.checkAccept = function (file) {
        var that = this;
        // 文件类型名称
        var typeNames = {
            file: '文件', images: '图片', video: '视频', audio: '音频'
        };
        var typeName = typeNames[that.options.upload.accept] || '文件';
        var text = that.options.upload.text || {}; // 错误信息设置
        // 根据文件类型校验
        var exts = that.options.upload.exts;
        var check = true;
        switch (that.options.upload.accept) {
            case 'file': // 一般文件
                if (exts && !RegExp('.\\.(' + exts + ')$', 'i').test(escape(file.name))) {
                    check = false;
                }
                break;
            case 'video': // 视频文件
                if (!RegExp('.\\.(' + (exts || 'avi|mp4|wma|rmvb|rm|flash|3gp|flv') + ')$', 'i').test(escape(file.name))) {
                    check = false;
                }
                break;
            case 'audio': // 音频文件
                if (!RegExp('.\\.(' + (exts || 'mp3|wav|mid') + ')$', 'i').test(escape(file.name))) {
                    check = false;
                }
                break;
            default: // 图片文件
                if (!RegExp('.\\.(' + (exts || 'jpg|png|gif|bmp|jpeg|svg') + ')$', 'i').test(escape(file.name))) {
                    check = false;
                }
                break;
        }
        if (!check) {
            that.msg(text['check-error'] || '选择的' + typeName + '中包含不支持的格式');
        }
        return check;
    };

    /**
     * 校验文件大小
     *
     * @param file
     * @returns {boolean}
     */
    uploadMore.prototype.checkSize = function (file) {
        var that = this;
        var device = layui.device();
        var text = that.options.upload.text || {}; // 错误信息设置
        var size = that.options.upload.size;
        if (size > 0 && !(device.ie && device.ie < 10)) {
            if (file.size > 1024 * size) {
                var sizeStr = size / 1024;
                sizeStr = sizeStr >= 1 ? sizeStr.toFixed(2) + 'MB' : size + 'KB';
                limitSize = sizeStr;
                if (limitSize) {
                    that.msg(typeof text['limit-size'] === 'function' ? text['limit-size'](that.upload.config, limitSize) : '文件大小不能超过 ' + limitSize);
                }
                return false;
            }
        }
        return true;
    };

    /**
     * 切换总上传状态
     *
     * @param isDisabled
     */
    uploadMore.prototype.switchUploadStatus = function (isDisabled = true) {
        var that = this;
        that.container.find('.uploadMore-uploadInput').siblings('input[type=file]:eq(0)').attr('disabled', isDisabled);
    };

    /**
     * 重置排序值
     */
    uploadMore.prototype.resetSort = function () {
        var that = this;
        var i = 0;
        that.getAllItem().each(function () {
            i++;
            var index = $(this).data('index');
            $(this).attr('data-sort-index', i);
            that.setItemInfo(index, {
                sort: i,
            });
        });
    };


    /** 进度对象 **/
    uploadMore.prototype.getProgressIns = function (index) {
        var that = this;
        return that.getItem(index).find('.uploadMore-progress');
    };

    /**
     * 改变进度
     *
     * @param index
     * @param percent
     * @returns {uploadMore}
     */
    uploadMore.prototype.changeProgress = function (index, percent) {
        var that = this;

        var progress = that.getProgressIns(index);
        if (percent > 0) {
            progress.removeClass('layui-hide');
        }
        layui.element.progress(that.getProgressFilterName(index), percent + '%');
        layui.element.render('progress');
        return this;
    };

    /**
     * 完成进度
     *
     * @param index
     * @param data
     * @param isHide
     */
    uploadMore.prototype.successProgress = function (index, data, isHide = true) {
        var that = this;
        var progress = that.getProgressIns(index);
        if (isHide) {
            progress.addClass('layui-hide');
        }
        that.setItemInfo(index, {
            isShowAction: true, fileInfo: data.fileInfo, url: data.url, isSuccess: true, status: 4,
        });

        that.getItem(index).attr('data-is-success', true);
        // 渲染数据
        that.getItem(index).find('.uploadMore-file').replaceWith(that.getFileTpl(index));
        // 初始进度条
        that.changeProgress(index, 0);

        // 执行回调
        if (that.options.on.success) {
            that.options.on.success(that.getItemInfo(index), that);
        }
    };

    /**
     * 失败进度处理
     *
     * @param index
     */
    uploadMore.prototype.failProgress = function (index) {
        var that = this;
        var progress = that.getProgressIns(index);
        progress.addClass('layui-hide');
        that.setItemInfo(index, {
            isShowAction: false, status: 3,
        });
        // 初始进度条
        that.changeProgress(index, 0);
    };

    /**
     * 错误处理
     *
     * @param index  下标
     * @param errMsg  错误信息
     * @param upload  上传重试回调
     */
    uploadMore.prototype.error = function (index, errMsg, upload) {
        var that = this;
        that.failProgress(index);
        that.getItem(index).find('.uploadMore-message').removeClass('layui-hide');
        that.getItem(index).find('.uploadMore-error').attr('data-tips', errMsg);
        // 触发回调
        if (that.options.on.error) {
            that.options.on.error(that.getItemInfo(index), that, errMsg);
        }
    };

    /**
     * 成功处理
     *
     *
     * @param currentIndex 下标
     * @param d
     * @returns {uploadMore}
     */
    uploadMore.prototype.success = function (currentIndex, d) {
        var that = this;
        that.successProgress(currentIndex, d);
        return that;
    }

    /**
     * 上传完成处理
     *
     * @param currentIndex
     * @param res
     */
    uploadMore.prototype.done = function (currentIndex, res) {
        var that = this;
        var d = res ? that.options.parseData(res) : null;
        var isTriggerQueueWork = !that.getItemInfo(currentIndex).isRetry;
        if (d && d.code === 0) {
            // 成功
            that.success(currentIndex, d);
        } else {
            // 错误
            that.error(currentIndex, (d && d.message) ? d.message : '上传失败', upload);
        }
        // 触发下一次队列任务
        if (isTriggerQueueWork) {
            that.queueWorkStatusNum++;
            var currentQueueWorkCount = that.queueWork[that.queueWorkKey] ? that.queueWork[that.queueWorkKey].length : 0;
            if (that.queueWork.length > 0 && that.queueWorkStatusNum >= currentQueueWorkCount) {
                that.triggerQueueWork(++that.queueWorkKey);
            }
        }
    }

    /**
     * 选择文件处理
     *
     * @param obj
     */
    uploadMore.prototype.choose = function (obj, type, itemIndex) {
        var that = this;
        layui.each(obj.getChooseFiles(), function (currentIndex, file) {
            if (that.isAllowAdd() || type === 2) {
                // 文件校验
                if (that.checkFile(file)) {
                    // 添加成员
                    that.addItem(currentIndex, file, itemIndex, obj);
                    // 上传
                    // obj.upload(currentIndex, file);
                }
            }
            // 制空文件
            that.container.find('input.uploadMore-uploadInput:eq(0)').next().val('');
        });
        var total = that.getWaitWorkCount();
        var chunkSize = that.options.concurrencyMaxNum > 0 ? that.options.concurrencyMaxNum : total;
        for (let i = 0; i < total; i += chunkSize) {
            var start = i;
            var size = i + chunkSize
            var item = that.waitWork.slice(start, size);
            that.queueWork.push(item);
        }
        that.waitWork = [];
        that.triggerQueueWork(that.queueWorkKey);
    };

    /**
     * 更新上传状态
     *
     * @param index
     * @param status
     */
    uploadMore.prototype.updateStatus = function (index, status) {
        var that = this;
        that.getItem(index).find('.uploadMore-item-status').text(that.statusText()[status]);
        that.setItemInfo(index, {
            status: status,
        });
    };
    /**
     *
     * 上传状态文案信息
     *
     * @returns {{1: string, 2: string, 3: string, 4: string}}
     */
    uploadMore.prototype.statusText = function () {
        return {
            1: '待上传', 2: '正在上传', 3: '上传失败', 4: '上传成功',
        };
    };

    /**
     * 获取成员信息
     *
     * @param index
     * @returns {*}
     */
    uploadMore.prototype.getItemInfo = function (index) {
        return this.items[this.getIndex(index)];
    };
    /**
     * 设置成员信息
     *
     * @param index
     * @param info
     * @returns {*}
     */
    uploadMore.prototype.setItemInfo = function (index, info) {
        var that = this;
        that.items[this.getIndex(index)] = $.extend(that.getItemInfo(index), info);
        return that.getItemInfo(index);
    };

    /**
     * 删除成员信息
     *
     *
     * @param index
     */
    uploadMore.prototype.delItemInfo = function (index) {
        var that = this;
        delete that.items[index];
    };

    /**
     * 获取当前数量
     *
     * @param isUpdate
     * @returns {*}
     */
    uploadMore.prototype.getCurrentNum = function (isUpdate = true) {
        var that = this;
        if (isUpdate) {
            that.currentNum = that.container.find('.uploadMore-item').length;
            that.container.find('.uploadMore-currentNum').text(that.currentNum);
        }
        return that.currentNum;
    };

    /**
     * 是否允许添加成员
     *
     * @returns {boolean}
     */
    uploadMore.prototype.isAllowAdd = function (addNum = 0) {
        return (this.options.maxNum <= 0 || (this.options.maxNum > 0 && this.getCurrentNum() + addNum < this.options.maxNum));
    };

    /**
     * 图片预览
     *
     * @param start
     * @param title
     */
    uploadMore.prototype.previewImage = function (start = 0, title = '图片') {
        var that = this;
        var data = [];
        that.getAllItem().each(function () {
            var index = $(this).data('index');
            var itemInfo = that.getItemInfo(index);
            if (itemInfo.isSuccess && $(this).find('.uploadMore-file').hasClass('uploadMore-img-preview')) {
                data.push({
                    alt: title, pid: index, src: itemInfo.url,
                });
            }
        });
        layer.photos({
            photos: {
                title: title, // title
                start: start, // 起始位置
                data: data, // 数据
                /*   "data": [
                               {
                                   "alt": title,
                                   "pid": 1,
                                   "src": src,
                               }
                           ]*/
            },
        });
    };
    /**
     * 消息弹窗
     *
     * @param content
     * @returns {*}
     */
    uploadMore.prototype.msg = function (content) {
        return layui.layer.msg(content, {
            icon: 2, shift: 6,
        });
    };
    /**
     * 获取元素模板
     */
    uploadMore.prototype.getItemTpl = function (index) {
        var that = this;
        var item = $('<div class="uploadMore-item" data-index="' + index + '"></div>');
        if (that.options.style.size > 0) {
            item.css({
                width: that.options.style.size + "px",
                height: that.options.style.size + "px",
            });
        }

        var itemInfo = that.getItemInfo(index);
        // 插入文件展示
        item.append(that.getFileTpl(index));

        // 排序展示
        if (that.options.sortable !== false) {
            // 插入拖拽排序按钮
            item.append(
                '<span class="uploadMore-drag">' +
                '   <span style="font-size: 16px; display: inline-flex;">' +
                '       <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' +
                '         aria-hidden="true" role="img"' +
                '         class="iconify iconify--ant-design" width="1em"' +
                '         height="1em" preserveAspectRatio="xMidYMid meet"' +
                '         viewBox="0 0 1024 1024">' +
                '         <path fill="currentColor" d="M847.9 592H152c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h605.2L612.9 851c-4.1 5.2-.4 13 6.3 13h72.5c4.9 0 9.5-2.2 12.6-6.1l168.8-214.1c16.5-21 1.6-51.8-25.2-51.8zM872 356H266.8l144.3-183c4.1-5.2.4-13-6.3-13h-72.5c-4.9 0-9.5 2.2-12.6 6.1L150.9 380.2c-16.5 21-1.6 51.8 25.1 51.8h696c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8z"></path>' +
                '       </svg>' +
                '   </span>' +
                '</span>');
        }
        // 插入蒙版操作
        if (that.options.operation.update || that.options.operation.preview || that.options.operation.delete) {
            var operationBox = $('<div class="uploadMore-operation layui-hide"><div class="uploadMore-operation-box"></div></div>');
            // 编辑按钮
            if (that.options.operation.update) {
                operationBox.find('.uploadMore-operation-box').append(
                    '<div  class="uploadMore-operation-action uploadMore-operation-action-edit" >'
                    + '       <i class="layui-icon layui-icon-edit"></i>' +
                    '      </div>'
                );
            }
            // 预览按钮
            if (that.options.operation.preview && that.isAllowPreview(itemInfo.mimeType)) {
                operationBox.find('.uploadMore-operation-box').append(
                    '<div  class="uploadMore-operation-action uploadMore-operation-action-preview" >' +
                    '           <i class="layui-icon layui-icon-eye"></i>' +
                    '      </div>'
                );
            }
            // 删除按钮
            if (that.options.operation.delete) {
                operationBox.find('.uploadMore-operation-box').append(
                    '<div  class="uploadMore-operation-action uploadMore-operation-action-delete">' +
                    '        <i class="layui-icon layui-icon-delete"></i>' +
                    '      </div>'
                );
            }
            item.append(operationBox);
        }
        // 加上进度条
        var filter = that.getProgressFilterName(index);
        item.append(
            '<div class="uploadMore-progress">' +
            '                <div class="uploadMore-progress-box" >' +
            '                   <div class="layui-progress layui-progress-big" lay-filter="' + filter + '" lay-showpercent="true">' +
            '                       <div class="layui-progress-bar" lay-percent="0%"></div>' +
            '                    </div>' +
            '                    <div class="uploadMore-item-status">待处理</div>' +
            '                 </div>' +
            '</div>'
        );
        // 加上错误信息展示
        item.append(
            '<div class="uploadMore-message layui-hide">' +
            '                <div class="uploadMore-message-box" >' +
            '                   <div class="uploadMore-message-content">' +
            '                       <span class="uploadMore-error" data-tips="测试错误信息"><i class="layui-icon layui-icon-face-cry"></i> 上传失败</span>' +
            '                       <span class="uploadMore-retryUpload"><i class="layui-icon layui-icon-refresh"></i> 重新上传</span>' +
            '                       <span class="uploadMore-operation-action-delete"><i class="layui-icon layui-icon-delete"></i> 直接删除</span>' +
            '                   </div>' +
            '                 </div>' +
            '        </div>'
        );

        return item;
    };

    /**
     * 获取文件模版
     *
     * @returns {*|jQuery|HTMLElement}
     */
    uploadMore.prototype.getFileTpl = function (index) {
        var that = this;
        var itemInfo = that.getItemInfo(index);
        var tpl;
        var mime = itemInfo.mimeType ? itemInfo.mimeType : '';
        if (mime.indexOf('image/') !== -1) {
            tpl = $(
                '<div class=" uploadMore-file uploadMore-img-preview">' +
                '    <img src="' + (itemInfo ? itemInfo.url : '') + '" style="height: 100%;max-height: 100%">' +
                '</div>'
            );
        } else {
            tpl = $('<div class=" uploadMore-file uploadMore-files-preview">' +
                '   <span><i class="layui-icon layui-icon-file"></i></span>' +
                '</div>'
            );
        }

        return tpl;
    };

    /**
     * 获取进度条 filterName
     *
     * @param index
     * @returns {string}
     */
    uploadMore.prototype.getProgressFilterName = function (index) {
        return 'uploadMore-progress-' + index;
    };

    /**
     * 上传按钮模板
     */
    uploadMore.prototype.getUploadBtnTpl = function () {
        var that = this;
        var item = $('<div class="uploadMore-uploadBtn"></div>');
        if (that.options.style.size > 0) {
            item.css({
                width: that.options.style.size + "px",
                height: that.options.style.size + "px",
            });
        }
        // 文件数量限制展示(限制文件数量)
        var isLimitMax = that.options.maxNum > 0;
        item.append(
            '<div class="uploadMore-fileNum" ' + (isLimitMax ? 'uploadMore-tips="最多支持上传' + that.options.maxNum + '个文件"' : '') + ' style="padding: 0 6px;">' +
            '    <span class="uploadMore-currentNum">0</span>' + '    <span class="' + (isLimitMax ? '' : 'layui-hide') + '">/</span>' +
            '    <span class="uploadMore-maxNum' + (isLimitMax ? '' : 'layui-hide') + '" >' + that.options.maxNum + '</span>' +
            '</div>'
        );

        // 上传图标展示
        var icon = that.options.upload.drag ? 'layui-icon-upload' : 'layui-icon-add-1';
        var text = that.options.upload.drag ? '拖拽或点击上传' : '点击上传';
        item.append('<label class="uploadMore-icon-box">' +
            '   <span style="font-size: 24px; display: inline-flex; ">' +
            '     <span>' +
            '        <i class="layui-icon ' + icon + '" style="font-size: 24px;" title="' + text + '"></i>' +
            '     </span>' +
            '  </span>' +
            '</label>'
        );
        return item;
    };

    /**
     * 切换上传按钮状态
     *
     * @param isHide
     * @returns {*}
     */
    uploadMore.prototype.switchUploadBtnStatus = function (isHide = false) {
        var that = this;
        if (isHide) {
            return that.uploadBtn.addClass('layui-hide');
        } else {
            return that.uploadBtn.removeClass('layui-hide');
        }
    };
    /**
     * 获取文件url地址集合
     *
     * @returns {*}
     */
    uploadMore.prototype.getFileUrls = function () {
        var that = this;
        var list = [];
        that.getAllItem().each(function () {
            var index = $(this).data('index');
            var itemInfo = that.getItemInfo(index);
            if (itemInfo.isSuccess) {
                list.push(itemInfo.url);
            }
        });
        return list;
    };
    /**
     * 获取文件信息集合
     *
     * @returns {*[]}
     */
    uploadMore.prototype.getFileInfos = function () {
        var that = this;
        var list = [];
        that.getAllItem().each(function () {
            var index = $(this).data('index');
            var itemInfo = that.getItemInfo(index);
            if (itemInfo.isSuccess) {
                list.push($.extend(itemInfo.fileInfo, {url: itemInfo.url}));
            }
        });
        return list;
    };

    /** 重载 */
    uploadMore.prototype.reload = function (opt) {
        var that = this;
        that.options = $.extend(true, {}, that.options, opt);
        that.init();
        return that;
    };

    /**
     * 是否允许预览
     *
     * @param mimeType
     * @returns {boolean}
     */
    uploadMore.prototype.isAllowPreview = function (mimeType) {
        mimeType = mimeType ? mimeType : '';
        return mimeType.indexOf('image/') !== -1; // 目前只支持图片
    };

    /** 清空 **/
    uploadMore.prototype.delete = function () {
        this.container.html('');
    };

    /**
     * 获取待处理数
     *
     * @returns {number}
     */
    uploadMore.prototype.getWaitWorkCount = function () {
        return this.waitWork.length;
    };
    /**
     * 推入队列
     *
     * @param queue
     */
    uploadMore.prototype.pushWaitWork = function (queue) {
        this.waitWork.push(queue);
        return this;
    };


    /** 对外提供的方法 */
    var uploadMoreObj = {
        options: {}, /* 渲染 */
        render: function (options) {
            return new uploadMore($.extend(true, {}, this.options, options));
        }, sleep: function (delay) {
            var start = (new Date()).getTime();
            while ((new Date()).getTime() - start < delay) {
                continue;
            }
        }, /**
         * 全局配置设置
         *
         * @param options
         */
        set: function (options) {
            this.options = options;
            return this;
        }, getMimeTypeByExt: function (ext) {
            var mimeType = {
                123: 'application/vnd.lotus-1-2-3',
                '3dml': 'text/vnd.in3d.3dml',
                '3ds': 'image/x-3ds',
                '3g2': 'video/3gpp2',
                '3gp': 'video/3gpp',
                '7z': 'application/x-7z-compressed',
                aab: 'application/x-authorware-bin',
                aac: 'audio/x-aac',
                aam: 'application/x-authorware-map',
                aas: 'application/x-authorware-seg',
                abw: 'application/x-abiword',
                ac: 'application/pkix-attr-cert',
                acc: 'application/vnd.americandynamics.acc',
                ace: 'application/x-ace-compressed',
                acu: 'application/vnd.acucobol',
                acutc: 'application/vnd.acucorp',
                adp: 'audio/adpcm',
                aep: 'application/vnd.audiograph',
                afm: 'application/x-font-type1',
                afp: 'application/vnd.ibm.modcap',
                ahead: 'application/vnd.ahead.space',
                ai: 'application/postscript',
                aif: 'audio/x-aiff',
                aifc: 'audio/x-aiff',
                aiff: 'audio/x-aiff',
                air: 'application/vnd.adobe.air-application-installer-package+zip',
                ait: 'application/vnd.dvb.ait',
                ami: 'application/vnd.amiga.ami',
                apk: 'application/vnd.android.package-archive',
                apng: 'image/apng',
                appcache: 'text/cache-manifest',
                application: 'application/x-ms-application',
                apr: 'application/vnd.lotus-approach',
                arc: 'application/x-freearc',
                asc: 'application/pgp-signature',
                asf: 'video/x-ms-asf',
                asm: 'text/x-asm',
                aso: 'application/vnd.accpac.simply.aso',
                asx: 'video/x-ms-asf',
                atc: 'application/vnd.acucorp',
                atom: 'application/atom+xml',
                atomcat: 'application/atomcat+xml',
                atomsvc: 'application/atomsvc+xml',
                atx: 'application/vnd.antix.game-component',
                au: 'audio/basic',
                avi: 'video/x-msvideo',
                avif: 'image/avif',
                aw: 'application/applixware',
                azf: 'application/vnd.airzip.filesecure.azf',
                azs: 'application/vnd.airzip.filesecure.azs',
                azw: 'application/vnd.amazon.ebook',
                bat: 'application/x-msdownload',
                bcpio: 'application/x-bcpio',
                bdf: 'application/x-font-bdf',
                bdm: 'application/vnd.syncml.dm+wbxml',
                bed: 'application/vnd.realvnc.bed',
                bh2: 'application/vnd.fujitsu.oasysprs',
                bin: 'application/octet-stream',
                blb: 'application/x-blorb',
                blorb: 'application/x-blorb',
                bmi: 'application/vnd.bmi',
                bmp: 'image/bmp',
                book: 'application/vnd.framemaker',
                box: 'application/vnd.previewsystems.box',
                boz: 'application/x-bzip2',
                bpk: 'application/octet-stream',
                btif: 'image/prs.btif',
                bz: 'application/x-bzip',
                bz2: 'application/x-bzip2',
                c: 'text/x-c',
                c11amc: 'application/vnd.cluetrust.cartomobile-config',
                c11amz: 'application/vnd.cluetrust.cartomobile-config-pkg',
                c4d: 'application/vnd.clonk.c4group',
                c4f: 'application/vnd.clonk.c4group',
                c4g: 'application/vnd.clonk.c4group',
                c4p: 'application/vnd.clonk.c4group',
                c4u: 'application/vnd.clonk.c4group',
                cab: 'application/vnd.ms-cab-compressed',
                caf: 'audio/x-caf',
                cap: 'application/vnd.tcpdump.pcap',
                car: 'application/vnd.curl.car',
                cat: 'application/vnd.ms-pki.seccat',
                cb7: 'application/x-cbr',
                cba: 'application/x-cbr',
                cbr: 'application/x-cbr',
                cbt: 'application/x-cbr',
                cbz: 'application/x-cbr',
                cc: 'text/x-c',
                cct: 'application/x-director',
                ccxml: 'application/ccxml+xml',
                cdbcmsg: 'application/vnd.contact.cmsg',
                cdf: 'application/x-netcdf',
                cdkey: 'application/vnd.mediastation.cdkey',
                cdmia: 'application/cdmi-capability',
                cdmic: 'application/cdmi-container',
                cdmid: 'application/cdmi-domain',
                cdmio: 'application/cdmi-object',
                cdmiq: 'application/cdmi-queue',
                cdx: 'chemical/x-cdx',
                cdxml: 'application/vnd.chemdraw+xml',
                cdy: 'application/vnd.cinderella',
                cer: 'application/pkix-cert',
                cfs: 'application/x-cfs-compressed',
                cgm: 'image/cgm',
                chat: 'application/x-chat',
                chm: 'application/vnd.ms-htmlhelp',
                chrt: 'application/vnd.kde.kchart',
                cif: 'chemical/x-cif',
                cii: 'application/vnd.anser-web-certificate-issue-initiation',
                cil: 'application/vnd.ms-artgalry',
                cla: 'application/vnd.claymore',
                class: 'application/java-vm',
                clkk: 'application/vnd.crick.clicker.keyboard',
                clkp: 'application/vnd.crick.clicker.palette',
                clkt: 'application/vnd.crick.clicker.template',
                clkw: 'application/vnd.crick.clicker.wordbank',
                clkx: 'application/vnd.crick.clicker',
                clp: 'application/x-msclip',
                cmc: 'application/vnd.cosmocaller',
                cmdf: 'chemical/x-cmdf',
                cml: 'chemical/x-cml',
                cmp: 'application/vnd.yellowriver-custom-menu',
                cmx: 'image/x-cmx',
                cod: 'application/vnd.rim.cod',
                com: 'application/x-msdownload',
                conf: 'text/plain',
                cpio: 'application/x-cpio',
                cpp: 'text/x-c',
                cpt: 'application/mac-compactpro',
                crd: 'application/x-mscardfile',
                crl: 'application/pkix-crl',
                crt: 'application/x-x509-ca-cert',
                cryptonote: 'application/vnd.rig.cryptonote',
                csh: 'application/x-csh',
                csml: 'chemical/x-csml',
                csp: 'application/vnd.commonspace',
                css: 'text/css',
                cst: 'application/x-director',
                csv: 'text/csv',
                cu: 'application/cu-seeme',
                curl: 'text/vnd.curl',
                cww: 'application/prs.cww',
                cxt: 'application/x-director',
                cxx: 'text/x-c',
                dae: 'model/vnd.collada+xml',
                daf: 'application/vnd.mobius.daf',
                dart: 'application/vnd.dart',
                dataless: 'application/vnd.fdsn.seed',
                davmount: 'application/davmount+xml',
                dbk: 'application/docbook+xml',
                dcr: 'application/x-director',
                dcurl: 'text/vnd.curl.dcurl',
                dd2: 'application/vnd.oma.dd2+xml',
                ddd: 'application/vnd.fujixerox.ddd',
                deb: 'application/x-debian-package',
                def: 'text/plain',
                deploy: 'application/octet-stream',
                der: 'application/x-x509-ca-cert',
                dfac: 'application/vnd.dreamfactory',
                dgc: 'application/x-dgc-compressed',
                dic: 'text/x-c',
                dir: 'application/x-director',
                dis: 'application/vnd.mobius.dis',
                dist: 'application/octet-stream',
                distz: 'application/octet-stream',
                djv: 'image/vnd.djvu',
                djvu: 'image/vnd.djvu',
                dll: 'application/x-msdownload',
                dmg: 'application/x-apple-diskimage',
                dmp: 'application/vnd.tcpdump.pcap',
                dms: 'application/octet-stream',
                dna: 'application/vnd.dna',
                doc: 'application/msword',
                docm: 'application/vnd.ms-word.document.macroenabled.12',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                dot: 'application/msword',
                dotm: 'application/vnd.ms-word.template.macroenabled.12',
                dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
                dp: 'application/vnd.osgi.dp',
                dpg: 'application/vnd.dpgraph',
                dra: 'audio/vnd.dra',
                dsc: 'text/prs.lines.tag',
                dssc: 'application/dssc+der',
                dtb: 'application/x-dtbook+xml',
                dtd: 'application/xml-dtd',
                dts: 'audio/vnd.dts',
                dtshd: 'audio/vnd.dts.hd',
                dump: 'application/octet-stream',
                dvb: 'video/vnd.dvb.file',
                dvi: 'application/x-dvi',
                dwf: 'model/vnd.dwf',
                dwg: 'image/vnd.dwg',
                dxf: 'image/vnd.dxf',
                dxp: 'application/vnd.spotfire.dxp',
                dxr: 'application/x-director',
                ecelp4800: 'audio/vnd.nuera.ecelp4800',
                ecelp7470: 'audio/vnd.nuera.ecelp7470',
                ecelp9600: 'audio/vnd.nuera.ecelp9600',
                ecma: 'application/ecmascript',
                edm: 'application/vnd.novadigm.edm',
                edx: 'application/vnd.novadigm.edx',
                efif: 'application/vnd.picsel',
                ei6: 'application/vnd.pg.osasli',
                elc: 'application/octet-stream',
                emf: 'application/x-msmetafile',
                eml: 'message/rfc822',
                emma: 'application/emma+xml',
                emz: 'application/x-msmetafile',
                eol: 'audio/vnd.digital-winds',
                eot: 'application/vnd.ms-fontobject',
                eps: 'application/postscript',
                epub: 'application/epub+zip',
                es3: 'application/vnd.eszigno3+xml',
                esa: 'application/vnd.osgi.subsystem',
                esf: 'application/vnd.epson.esf',
                et3: 'application/vnd.eszigno3+xml',
                etx: 'text/x-setext',
                eva: 'application/x-eva',
                evy: 'application/x-envoy',
                exe: 'application/x-msdownload',
                exi: 'application/exi',
                ext: 'application/vnd.novadigm.ext',
                ez: 'application/andrew-inset',
                ez2: 'application/vnd.ezpix-album',
                ez3: 'application/vnd.ezpix-package',
                f: 'text/x-fortran',
                f4v: 'video/x-f4v',
                f77: 'text/x-fortran',
                f90: 'text/x-fortran',
                fbs: 'image/vnd.fastbidsheet',
                fcdt: 'application/vnd.adobe.formscentral.fcdt',
                fcs: 'application/vnd.isac.fcs',
                fdf: 'application/vnd.fdf',
                fe_launch: 'application/vnd.denovo.fcselayout-link',
                fg5: 'application/vnd.fujitsu.oasysgp',
                fgd: 'application/x-director',
                fh: 'image/x-freehand',
                fh4: 'image/x-freehand',
                fh5: 'image/x-freehand',
                fh7: 'image/x-freehand',
                fhc: 'image/x-freehand',
                fig: 'application/x-xfig',
                flac: 'audio/x-flac',
                fli: 'video/x-fli',
                flo: 'application/vnd.micrografx.flo',
                flv: 'video/x-flv',
                flw: 'application/vnd.kde.kivio',
                flx: 'text/vnd.fmi.flexstor',
                fly: 'text/vnd.fly',
                fm: 'application/vnd.framemaker',
                fnc: 'application/vnd.frogans.fnc',
                for: 'text/x-fortran',
                fpx: 'image/vnd.fpx',
                frame: 'application/vnd.framemaker',
                fsc: 'application/vnd.fsc.weblaunch',
                fst: 'image/vnd.fst',
                ftc: 'application/vnd.fluxtime.clip',
                fti: 'application/vnd.anser-web-funds-transfer-initiation',
                fvt: 'video/vnd.fvt',
                fxp: 'application/vnd.adobe.fxp',
                fxpl: 'application/vnd.adobe.fxp',
                fzs: 'application/vnd.fuzzysheet',
                g2w: 'application/vnd.geoplan',
                g3: 'image/g3fax',
                g3w: 'application/vnd.geospace',
                gac: 'application/vnd.groove-account',
                gam: 'application/x-tads',
                gbr: 'application/rpki-ghostbusters',
                gca: 'application/x-gca-compressed',
                gdl: 'model/vnd.gdl',
                geo: 'application/vnd.dynageo',
                gex: 'application/vnd.geometry-explorer',
                ggb: 'application/vnd.geogebra.file',
                ggs: 'application/vnd.geogebra.slides',
                ggt: 'application/vnd.geogebra.tool',
                ghf: 'application/vnd.groove-help',
                gif: 'image/gif',
                gim: 'application/vnd.groove-identity-message',
                gml: 'application/gml+xml',
                gmx: 'application/vnd.gmx',
                gnumeric: 'application/x-gnumeric',
                gph: 'application/vnd.flographit',
                gpx: 'application/gpx+xml',
                gqf: 'application/vnd.grafeq',
                gqs: 'application/vnd.grafeq',
                gram: 'application/srgs',
                gramps: 'application/x-gramps-xml',
                gre: 'application/vnd.geometry-explorer',
                grv: 'application/vnd.groove-injector',
                grxml: 'application/srgs+xml',
                gsf: 'application/x-font-ghostscript',
                gtar: 'application/x-gtar',
                gtm: 'application/vnd.groove-tool-message',
                gtw: 'model/vnd.gtw',
                gv: 'text/vnd.graphviz',
                gxf: 'application/gxf',
                gxt: 'application/vnd.geonext',
                h: 'text/x-c',
                h261: 'video/h261',
                h263: 'video/h263',
                h264: 'video/h264',
                hal: 'application/vnd.hal+xml',
                hbci: 'application/vnd.hbci',
                hdf: 'application/x-hdf',
                hh: 'text/x-c',
                hlp: 'application/winhlp',
                hpgl: 'application/vnd.hp-hpgl',
                hpid: 'application/vnd.hp-hpid',
                hps: 'application/vnd.hp-hps',
                hqx: 'application/mac-binhex40',
                htke: 'application/vnd.kenameaapp',
                htm: 'text/html',
                html: 'text/html',
                hvd: 'application/vnd.yamaha.hv-dic',
                hvp: 'application/vnd.yamaha.hv-voice',
                hvs: 'application/vnd.yamaha.hv-script',
                i2g: 'application/vnd.intergeo',
                icc: 'application/vnd.iccprofile',
                ice: 'x-conference/x-cooltalk',
                icm: 'application/vnd.iccprofile',
                ico: 'image/x-icon',
                ics: 'text/calendar',
                ief: 'image/ief',
                ifb: 'text/calendar',
                ifm: 'application/vnd.shana.informed.formdata',
                iges: 'model/iges',
                igl: 'application/vnd.igloader',
                igm: 'application/vnd.insors.igm',
                igs: 'model/iges',
                igx: 'application/vnd.micrografx.igx',
                iif: 'application/vnd.shana.informed.interchange',
                imp: 'application/vnd.accpac.simply.imp',
                ims: 'application/vnd.ms-ims',
                in: 'text/plain',
                ink: 'application/inkml+xml',
                inkml: 'application/inkml+xml',
                install: 'application/x-install-instructions',
                iota: 'application/vnd.astraea-software.iota',
                ipfix: 'application/ipfix',
                ipk: 'application/vnd.shana.informed.package',
                irm: 'application/vnd.ibm.rights-management',
                irp: 'application/vnd.irepository.package+xml',
                iso: 'application/x-iso9660-image',
                itp: 'application/vnd.shana.informed.formtemplate',
                ivp: 'application/vnd.immervision-ivp',
                ivu: 'application/vnd.immervision-ivu',
                jad: 'text/vnd.sun.j2me.app-descriptor',
                jam: 'application/vnd.jam',
                jar: 'application/java-archive',
                java: 'text/x-java-source',
                jfif: 'image/jpeg',
                jisp: 'application/vnd.jisp',
                jlt: 'application/vnd.hp-jlyt',
                jnlp: 'application/x-java-jnlp-file',
                joda: 'application/vnd.joost.joda-archive',
                jpe: 'image/jpeg',
                jpeg: 'image/jpeg',
                jpg: 'image/jpeg',
                jpgm: 'video/jpm',
                jpgv: 'video/jpeg',
                jpm: 'video/jpm',
                js: 'text/javascript',
                json: 'application/json',
                jsonml: 'application/jsonml+json',
                kar: 'audio/midi',
                karbon: 'application/vnd.kde.karbon',
                kfo: 'application/vnd.kde.kformula',
                kia: 'application/vnd.kidspiration',
                kml: 'application/vnd.google-earth.kml+xml',
                kmz: 'application/vnd.google-earth.kmz',
                kne: 'application/vnd.kinar',
                knp: 'application/vnd.kinar',
                kon: 'application/vnd.kde.kontour',
                kpr: 'application/vnd.kde.kpresenter',
                kpt: 'application/vnd.kde.kpresenter',
                kpxx: 'application/vnd.ds-keypoint',
                ksp: 'application/vnd.kde.kspread',
                ktr: 'application/vnd.kahootz',
                ktx: 'image/ktx',
                ktz: 'application/vnd.kahootz',
                kwd: 'application/vnd.kde.kword',
                kwt: 'application/vnd.kde.kword',
                lasxml: 'application/vnd.las.las+xml',
                latex: 'application/x-latex',
                lbd: 'application/vnd.llamagraphics.life-balance.desktop',
                lbe: 'application/vnd.llamagraphics.life-balance.exchange+xml',
                les: 'application/vnd.hhe.lesson-player',
                lha: 'application/x-lzh-compressed',
                link66: 'application/vnd.route66.link66+xml',
                list: 'text/plain',
                list3820: 'application/vnd.ibm.modcap',
                listafp: 'application/vnd.ibm.modcap',
                lnk: 'application/x-ms-shortcut',
                log: 'text/plain',
                lostxml: 'application/lost+xml',
                lrf: 'application/octet-stream',
                lrm: 'application/vnd.ms-lrm',
                ltf: 'application/vnd.frogans.ltf',
                lvp: 'audio/vnd.lucent.voice',
                lwp: 'application/vnd.lotus-wordpro',
                lzh: 'application/x-lzh-compressed',
                m13: 'application/x-msmediaview',
                m14: 'application/x-msmediaview',
                m1v: 'video/mpeg',
                m21: 'application/mp21',
                m2a: 'audio/mpeg',
                m2v: 'video/mpeg',
                m3a: 'audio/mpeg',
                m3u: 'audio/x-mpegurl',
                m3u8: 'application/vnd.apple.mpegurl',
                m4a: 'audio/mp4',
                m4u: 'video/vnd.mpegurl',
                m4v: 'video/x-m4v',
                ma: 'application/mathematica',
                mads: 'application/mads+xml',
                mag: 'application/vnd.ecowin.chart',
                maker: 'application/vnd.framemaker',
                man: 'text/troff',
                mar: 'application/octet-stream',
                mathml: 'application/mathml+xml',
                mb: 'application/mathematica',
                mbk: 'application/vnd.mobius.mbk',
                mbox: 'application/mbox',
                mc1: 'application/vnd.medcalcdata',
                mcd: 'application/vnd.mcd',
                mcurl: 'text/vnd.curl.mcurl',
                mdb: 'application/x-msaccess',
                mdi: 'image/vnd.ms-modi',
                me: 'text/troff',
                mesh: 'model/mesh',
                meta4: 'application/metalink4+xml',
                metalink: 'application/metalink+xml',
                mets: 'application/mets+xml',
                mfm: 'application/vnd.mfmp',
                mft: 'application/rpki-manifest',
                mgp: 'application/vnd.osgeo.mapguide.package',
                mgz: 'application/vnd.proteus.magazine',
                mid: 'audio/midi',
                midi: 'audio/midi',
                mie: 'application/x-mie',
                mif: 'application/vnd.mif',
                mime: 'message/rfc822',
                mj2: 'video/mj2',
                mjp2: 'video/mj2',
                mjs: 'text/javascript',
                mk3d: 'video/x-matroska',
                mka: 'audio/x-matroska',
                mks: 'video/x-matroska',
                mkv: 'video/x-matroska',
                mlp: 'application/vnd.dolby.mlp',
                mmd: 'application/vnd.chipnuts.karaoke-mmd',
                mmf: 'application/vnd.smaf',
                mmr: 'image/vnd.fujixerox.edmics-mmr',
                mng: 'video/x-mng',
                mny: 'application/x-msmoney',
                mobi: 'application/x-mobipocket-ebook',
                mods: 'application/mods+xml',
                mov: 'video/quicktime',
                movie: 'video/x-sgi-movie',
                mp2: 'audio/mpeg',
                mp21: 'application/mp21',
                mp2a: 'audio/mpeg',
                mp3: 'audio/mpeg',
                mp4: 'video/mp4',
                mp4a: 'audio/mp4',
                mp4s: 'application/mp4',
                mp4v: 'video/mp4',
                mpc: 'application/vnd.mophun.certificate',
                mpe: 'video/mpeg',
                mpeg: 'video/mpeg',
                mpg: 'video/mpeg',
                mpg4: 'video/mp4',
                mpga: 'audio/mpeg',
                mpkg: 'application/vnd.apple.installer+xml',
                mpm: 'application/vnd.blueice.multipass',
                mpn: 'application/vnd.mophun.application',
                mpp: 'application/vnd.ms-project',
                mpt: 'application/vnd.ms-project',
                mpy: 'application/vnd.ibm.minipay',
                mqy: 'application/vnd.mobius.mqy',
                mrc: 'application/marc',
                mrcx: 'application/marcxml+xml',
                ms: 'text/troff',
                mscml: 'application/mediaservercontrol+xml',
                mseed: 'application/vnd.fdsn.mseed',
                mseq: 'application/vnd.mseq',
                msf: 'application/vnd.epson.msf',
                msh: 'model/mesh',
                msi: 'application/x-msdownload',
                msl: 'application/vnd.mobius.msl',
                msty: 'application/vnd.muvee.style',
                mts: 'model/vnd.mts',
                mus: 'application/vnd.musician',
                musicxml: 'application/vnd.recordare.musicxml+xml',
                mvb: 'application/x-msmediaview',
                mwf: 'application/vnd.mfer',
                mxf: 'application/mxf',
                mxl: 'application/vnd.recordare.musicxml',
                mxml: 'application/xv+xml',
                mxs: 'application/vnd.triscape.mxs',
                mxu: 'video/vnd.mpegurl',
                'n-gage': 'application/vnd.nokia.n-gage.symbian.install',
                n3: 'text/n3',
                nb: 'application/mathematica',
                nbp: 'application/vnd.wolfram.player',
                nc: 'application/x-netcdf',
                ncx: 'application/x-dtbncx+xml',
                nfo: 'text/x-nfo',
                ngdat: 'application/vnd.nokia.n-gage.data',
                nitf: 'application/vnd.nitf',
                nlu: 'application/vnd.neurolanguage.nlu',
                nml: 'application/vnd.enliven',
                nnd: 'application/vnd.noblenet-directory',
                nns: 'application/vnd.noblenet-sealer',
                nnw: 'application/vnd.noblenet-web',
                npx: 'image/vnd.net-fpx',
                nsc: 'application/x-conference',
                nsf: 'application/vnd.lotus-notes',
                ntf: 'application/vnd.nitf',
                nzb: 'application/x-nzb',
                oa2: 'application/vnd.fujitsu.oasys2',
                oa3: 'application/vnd.fujitsu.oasys3',
                oas: 'application/vnd.fujitsu.oasys',
                obd: 'application/x-msbinder',
                obj: 'application/x-tgif',
                oda: 'application/oda',
                odb: 'application/vnd.oasis.opendocument.database',
                odc: 'application/vnd.oasis.opendocument.chart',
                odf: 'application/vnd.oasis.opendocument.formula',
                odft: 'application/vnd.oasis.opendocument.formula-template',
                odg: 'application/vnd.oasis.opendocument.graphics',
                odi: 'application/vnd.oasis.opendocument.image',
                odm: 'application/vnd.oasis.opendocument.text-master',
                odp: 'application/vnd.oasis.opendocument.presentation',
                ods: 'application/vnd.oasis.opendocument.spreadsheet',
                odt: 'application/vnd.oasis.opendocument.text',
                oga: 'audio/ogg',
                ogg: 'audio/ogg',
                ogv: 'video/ogg',
                ogx: 'application/ogg',
                omdoc: 'application/omdoc+xml',
                onepkg: 'application/onenote',
                onetmp: 'application/onenote',
                onetoc: 'application/onenote',
                onetoc2: 'application/onenote',
                opf: 'application/oebps-package+xml',
                opml: 'text/x-opml',
                oprc: 'application/vnd.palm',
                opus: 'audio/ogg',
                org: 'application/vnd.lotus-organizer',
                osf: 'application/vnd.yamaha.openscoreformat',
                osfpvg: 'application/vnd.yamaha.openscoreformat.osfpvg+xml',
                otc: 'application/vnd.oasis.opendocument.chart-template',
                otf: 'font/otf',
                otg: 'application/vnd.oasis.opendocument.graphics-template',
                oth: 'application/vnd.oasis.opendocument.text-web',
                oti: 'application/vnd.oasis.opendocument.image-template',
                otp: 'application/vnd.oasis.opendocument.presentation-template',
                ots: 'application/vnd.oasis.opendocument.spreadsheet-template',
                ott: 'application/vnd.oasis.opendocument.text-template',
                oxps: 'application/oxps',
                oxt: 'application/vnd.openofficeorg.extension',
                p: 'text/x-pascal',
                p10: 'application/pkcs10',
                p12: 'application/x-pkcs12',
                p7b: 'application/x-pkcs7-certificates',
                p7c: 'application/pkcs7-mime',
                p7m: 'application/pkcs7-mime',
                p7r: 'application/x-pkcs7-certreqresp',
                p7s: 'application/pkcs7-signature',
                p8: 'application/pkcs8',
                pas: 'text/x-pascal',
                paw: 'application/vnd.pawaafile',
                pbd: 'application/vnd.powerbuilder6',
                pbm: 'image/x-portable-bitmap',
                pcap: 'application/vnd.tcpdump.pcap',
                pcf: 'application/x-font-pcf',
                pcl: 'application/vnd.hp-pcl',
                pclxl: 'application/vnd.hp-pclxl',
                pct: 'image/x-pict',
                pcurl: 'application/vnd.curl.pcurl',
                pcx: 'image/x-pcx',
                pdb: 'application/vnd.palm',
                pdf: 'application/pdf',
                pfa: 'application/x-font-type1',
                pfb: 'application/x-font-type1',
                pfm: 'application/x-font-type1',
                pfr: 'application/font-tdpfr',
                pfx: 'application/x-pkcs12',
                pgm: 'image/x-portable-graymap',
                pgn: 'application/x-chess-pgn',
                pgp: 'application/pgp-encrypted',
                pic: 'image/x-pict',
                pjp: 'image/jpeg',
                pjpeg: 'image/jpeg',
                pkg: 'application/octet-stream',
                pki: 'application/pkixcmp',
                pkipath: 'application/pkix-pkipath',
                plb: 'application/vnd.3gpp.pic-bw-large',
                plc: 'application/vnd.mobius.plc',
                plf: 'application/vnd.pocketlearn',
                pls: 'application/pls+xml',
                pml: 'application/vnd.ctc-posml',
                png: 'image/png',
                pnm: 'image/x-portable-anymap',
                portpkg: 'application/vnd.macports.portpkg',
                pot: 'application/vnd.ms-powerpoint',
                potm: 'application/vnd.ms-powerpoint.template.macroenabled.12',
                potx: 'application/vnd.openxmlformats-officedocument.presentationml.template',
                ppam: 'application/vnd.ms-powerpoint.addin.macroenabled.12',
                ppd: 'application/vnd.cups-ppd',
                ppm: 'image/x-portable-pixmap',
                pps: 'application/vnd.ms-powerpoint',
                ppsm: 'application/vnd.ms-powerpoint.slideshow.macroenabled.12',
                ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
                ppt: 'application/vnd.ms-powerpoint',
                pptm: 'application/vnd.ms-powerpoint.presentation.macroenabled.12',
                pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                pqa: 'application/vnd.palm',
                prc: 'application/x-mobipocket-ebook',
                pre: 'application/vnd.lotus-freelance',
                prf: 'application/pics-rules',
                ps: 'application/postscript',
                psb: 'application/vnd.3gpp.pic-bw-small',
                psd: 'image/vnd.adobe.photoshop',
                psf: 'application/x-font-linux-psf',
                pskcxml: 'application/pskc+xml',
                ptid: 'application/vnd.pvi.ptid1',
                pub: 'application/x-mspublisher',
                pvb: 'application/vnd.3gpp.pic-bw-var',
                pwn: 'application/vnd.3m.post-it-notes',
                pya: 'audio/vnd.ms-playready.media.pya',
                pyv: 'video/vnd.ms-playready.media.pyv',
                qam: 'application/vnd.epson.quickanime',
                qbo: 'application/vnd.intu.qbo',
                qfx: 'application/vnd.intu.qfx',
                qps: 'application/vnd.publishare-delta-tree',
                qt: 'video/quicktime',
                qwd: 'application/vnd.quark.quarkxpress',
                qwt: 'application/vnd.quark.quarkxpress',
                qxb: 'application/vnd.quark.quarkxpress',
                qxd: 'application/vnd.quark.quarkxpress',
                qxl: 'application/vnd.quark.quarkxpress',
                qxt: 'application/vnd.quark.quarkxpress',
                ra: 'audio/x-pn-realaudio',
                ram: 'audio/x-pn-realaudio',
                rar: 'application/x-rar-compressed',
                ras: 'image/x-cmu-raster',
                rcprofile: 'application/vnd.ipunplugged.rcprofile',
                rdf: 'application/rdf+xml',
                rdz: 'application/vnd.data-vision.rdz',
                rep: 'application/vnd.businessobjects',
                res: 'application/x-dtbresource+xml',
                rgb: 'image/x-rgb',
                rif: 'application/reginfo+xml',
                rip: 'audio/vnd.rip',
                ris: 'application/x-research-info-systems',
                rl: 'application/resource-lists+xml',
                rlc: 'image/vnd.fujixerox.edmics-rlc',
                rld: 'application/resource-lists-diff+xml',
                rm: 'application/vnd.rn-realmedia',
                rmi: 'audio/midi',
                rmp: 'audio/x-pn-realaudio-plugin',
                rms: 'application/vnd.jcp.javame.midlet-rms',
                rmvb: 'application/vnd.rn-realmedia-vbr',
                rnc: 'application/relax-ng-compact-syntax',
                roa: 'application/rpki-roa',
                roff: 'text/troff',
                rp9: 'application/vnd.cloanto.rp9',
                rpss: 'application/vnd.nokia.radio-presets',
                rpst: 'application/vnd.nokia.radio-preset',
                rq: 'application/sparql-query',
                rs: 'application/rls-services+xml',
                rsd: 'application/rsd+xml',
                rss: 'application/rss+xml',
                rtf: 'application/rtf',
                rtx: 'text/richtext',
                s: 'text/x-asm',
                s3m: 'audio/s3m',
                saf: 'application/vnd.yamaha.smaf-audio',
                sbml: 'application/sbml+xml',
                sc: 'application/vnd.ibm.secure-container',
                scd: 'application/x-msschedule',
                scm: 'application/vnd.lotus-screencam',
                scq: 'application/scvp-cv-request',
                scs: 'application/scvp-cv-response',
                scurl: 'text/vnd.curl.scurl',
                sda: 'application/vnd.stardivision.draw',
                sdc: 'application/vnd.stardivision.calc',
                sdd: 'application/vnd.stardivision.impress',
                sdkd: 'application/vnd.solent.sdkm+xml',
                sdkm: 'application/vnd.solent.sdkm+xml',
                sdp: 'application/sdp',
                sdw: 'application/vnd.stardivision.writer',
                see: 'application/vnd.seemail',
                seed: 'application/vnd.fdsn.seed',
                sema: 'application/vnd.sema',
                semd: 'application/vnd.semd',
                semf: 'application/vnd.semf',
                ser: 'application/java-serialized-object',
                setpay: 'application/set-payment-initiation',
                setreg: 'application/set-registration-initiation',
                'sfd-hdstx': 'application/vnd.hydrostatix.sof-data',
                sfs: 'application/vnd.spotfire.sfs',
                sfv: 'text/x-sfv',
                sgi: 'image/sgi',
                sgl: 'application/vnd.stardivision.writer-global',
                sgm: 'text/sgml',
                sgml: 'text/sgml',
                sh: 'application/x-sh',
                shar: 'application/x-shar',
                shf: 'application/shf+xml',
                sid: 'image/x-mrsid-image',
                sig: 'application/pgp-signature',
                sil: 'audio/silk',
                silo: 'model/mesh',
                sis: 'application/vnd.symbian.install',
                sisx: 'application/vnd.symbian.install',
                sit: 'application/x-stuffit',
                sitx: 'application/x-stuffitx',
                skd: 'application/vnd.koan',
                skm: 'application/vnd.koan',
                skp: 'application/vnd.koan',
                skt: 'application/vnd.koan',
                sldm: 'application/vnd.ms-powerpoint.slide.macroenabled.12',
                sldx: 'application/vnd.openxmlformats-officedocument.presentationml.slide',
                slt: 'application/vnd.epson.salt',
                sm: 'application/vnd.stepmania.stepchart',
                smf: 'application/vnd.stardivision.math',
                smi: 'application/smil+xml',
                smil: 'application/smil+xml',
                smv: 'video/x-smv',
                smzip: 'application/vnd.stepmania.package',
                snd: 'audio/basic',
                snf: 'application/x-font-snf',
                so: 'application/octet-stream',
                spc: 'application/x-pkcs7-certificates',
                spf: 'application/vnd.yamaha.smaf-phrase',
                spl: 'application/x-futuresplash',
                spot: 'text/vnd.in3d.spot',
                spp: 'application/scvp-vp-response',
                spq: 'application/scvp-vp-request',
                spx: 'audio/ogg',
                sql: 'application/x-sql',
                src: 'application/x-wais-source',
                srt: 'application/x-subrip',
                sru: 'application/sru+xml',
                srx: 'application/sparql-results+xml',
                ssdl: 'application/ssdl+xml',
                sse: 'application/vnd.kodak-descriptor',
                ssf: 'application/vnd.epson.ssf',
                ssml: 'application/ssml+xml',
                st: 'application/vnd.sailingtracker.track',
                stc: 'application/vnd.sun.xml.calc.template',
                std: 'application/vnd.sun.xml.draw.template',
                stf: 'application/vnd.wt.stf',
                sti: 'application/vnd.sun.xml.impress.template',
                stk: 'application/hyperstudio',
                stl: 'application/vnd.ms-pki.stl',
                str: 'application/vnd.pg.format',
                stw: 'application/vnd.sun.xml.writer.template',
                sub: 'text/vnd.dvb.subtitle',
                sus: 'application/vnd.sus-calendar',
                susp: 'application/vnd.sus-calendar',
                sv4cpio: 'application/x-sv4cpio',
                sv4crc: 'application/x-sv4crc',
                svc: 'application/vnd.dvb.service',
                svd: 'application/vnd.svd',
                svg: 'image/svg+xml',
                svgz: 'image/svg+xml',
                swa: 'application/x-director',
                swf: 'application/x-shockwave-flash',
                swi: 'application/vnd.aristanetworks.swi',
                sxc: 'application/vnd.sun.xml.calc',
                sxd: 'application/vnd.sun.xml.draw',
                sxg: 'application/vnd.sun.xml.writer.global',
                sxi: 'application/vnd.sun.xml.impress',
                sxm: 'application/vnd.sun.xml.math',
                sxw: 'application/vnd.sun.xml.writer',
                t: 'text/troff',
                t3: 'application/x-t3vm-image',
                taglet: 'application/vnd.mynfc',
                tao: 'application/vnd.tao.intent-module-archive',
                tar: 'application/x-tar',
                tcap: 'application/vnd.3gpp2.tcap',
                tcl: 'application/x-tcl',
                teacher: 'application/vnd.smart.teacher',
                tei: 'application/tei+xml',
                teicorpus: 'application/tei+xml',
                tex: 'application/x-tex',
                texi: 'application/x-texinfo',
                texinfo: 'application/x-texinfo',
                text: 'text/plain',
                tfi: 'application/thraud+xml',
                tfm: 'application/x-tex-tfm',
                tga: 'image/x-tga',
                thmx: 'application/vnd.ms-officetheme',
                tif: 'image/tiff',
                tiff: 'image/tiff',
                tmo: 'application/vnd.tmobile-livetv',
                torrent: 'application/x-bittorrent',
                tpl: 'application/vnd.groove-tool-template',
                tpt: 'application/vnd.trid.tpt',
                tr: 'text/troff',
                tra: 'application/vnd.trueapp',
                trm: 'application/x-msterminal',
                tsd: 'application/timestamped-data',
                tsv: 'text/tab-separated-values',
                ttc: 'font/collection',
                ttf: 'font/ttf',
                ttl: 'text/turtle',
                twd: 'application/vnd.simtech-mindmapper',
                twds: 'application/vnd.simtech-mindmapper',
                txd: 'application/vnd.genomatix.tuxedo',
                txf: 'application/vnd.mobius.txf',
                txt: 'text/plain',
                u32: 'application/x-authorware-bin',
                udeb: 'application/x-debian-package',
                ufd: 'application/vnd.ufdl',
                ufdl: 'application/vnd.ufdl',
                ulx: 'application/x-glulx',
                umj: 'application/vnd.umajin',
                unityweb: 'application/vnd.unity',
                uoml: 'application/vnd.uoml+xml',
                uri: 'text/uri-list',
                uris: 'text/uri-list',
                urls: 'text/uri-list',
                ustar: 'application/x-ustar',
                utz: 'application/vnd.uiq.theme',
                uu: 'text/x-uuencode',
                uva: 'audio/vnd.dece.audio',
                uvd: 'application/vnd.dece.data',
                uvf: 'application/vnd.dece.data',
                uvg: 'image/vnd.dece.graphic',
                uvh: 'video/vnd.dece.hd',
                uvi: 'image/vnd.dece.graphic',
                uvm: 'video/vnd.dece.mobile',
                uvp: 'video/vnd.dece.pd',
                uvs: 'video/vnd.dece.sd',
                uvt: 'application/vnd.dece.ttml+xml',
                uvu: 'video/vnd.uvvu.mp4',
                uvv: 'video/vnd.dece.video',
                uvva: 'audio/vnd.dece.audio',
                uvvd: 'application/vnd.dece.data',
                uvvf: 'application/vnd.dece.data',
                uvvg: 'image/vnd.dece.graphic',
                uvvh: 'video/vnd.dece.hd',
                uvvi: 'image/vnd.dece.graphic',
                uvvm: 'video/vnd.dece.mobile',
                uvvp: 'video/vnd.dece.pd',
                uvvs: 'video/vnd.dece.sd',
                uvvt: 'application/vnd.dece.ttml+xml',
                uvvu: 'video/vnd.uvvu.mp4',
                uvvv: 'video/vnd.dece.video',
                uvvx: 'application/vnd.dece.unspecified',
                uvvz: 'application/vnd.dece.zip',
                uvx: 'application/vnd.dece.unspecified',
                uvz: 'application/vnd.dece.zip',
                vcard: 'text/vcard',
                vcd: 'application/x-cdlink',
                vcf: 'text/x-vcard',
                vcg: 'application/vnd.groove-vcard',
                vcs: 'text/x-vcalendar',
                vcx: 'application/vnd.vcx',
                vis: 'application/vnd.visionary',
                viv: 'video/vnd.vivo',
                vob: 'video/x-ms-vob',
                vor: 'application/vnd.stardivision.writer',
                vox: 'application/x-authorware-bin',
                vrml: 'model/vrml',
                vsd: 'application/vnd.visio',
                vsf: 'application/vnd.vsf',
                vss: 'application/vnd.visio',
                vst: 'application/vnd.visio',
                vsw: 'application/vnd.visio',
                vtu: 'model/vnd.vtu',
                vxml: 'application/voicexml+xml',
                w3d: 'application/x-director',
                wad: 'application/x-doom',
                wasm: 'application/wasm',
                wav: 'audio/x-wav',
                wax: 'audio/x-ms-wax',
                wbmp: 'image/vnd.wap.wbmp',
                wbs: 'application/vnd.criticaltools.wbs+xml',
                wbxml: 'application/vnd.wap.wbxml',
                wcm: 'application/vnd.ms-works',
                wdb: 'application/vnd.ms-works',
                wdp: 'image/vnd.ms-photo',
                weba: 'audio/webm',
                webm: 'video/webm',
                webp: 'image/webp',
                wg: 'application/vnd.pmi.widget',
                wgt: 'application/widget',
                wks: 'application/vnd.ms-works',
                wm: 'video/x-ms-wm',
                wma: 'audio/x-ms-wma',
                wmd: 'application/x-ms-wmd',
                wmf: 'application/x-msmetafile',
                wml: 'text/vnd.wap.wml',
                wmlc: 'application/vnd.wap.wmlc',
                wmls: 'text/vnd.wap.wmlscript',
                wmlsc: 'application/vnd.wap.wmlscriptc',
                wmv: 'video/x-ms-wmv',
                wmx: 'video/x-ms-wmx',
                wmz: 'application/x-msmetafile',
                woff: 'font/woff',
                woff2: 'font/woff2',
                wpd: 'application/vnd.wordperfect',
                wpl: 'application/vnd.ms-wpl',
                wps: 'application/vnd.ms-works',
                wqd: 'application/vnd.wqd',
                wri: 'application/x-mswrite',
                wrl: 'model/vrml',
                wsdl: 'application/wsdl+xml',
                wspolicy: 'application/wspolicy+xml',
                wtb: 'application/vnd.webturbo',
                wvx: 'video/x-ms-wvx',
                x32: 'application/x-authorware-bin',
                x3d: 'model/x3d+xml',
                x3db: 'model/x3d+binary',
                x3dbz: 'model/x3d+binary',
                x3dv: 'model/x3d+vrml',
                x3dvz: 'model/x3d+vrml',
                x3dz: 'model/x3d+xml',
                xaml: 'application/xaml+xml',
                xap: 'application/x-silverlight-app',
                xar: 'application/vnd.xara',
                xbap: 'application/x-ms-xbap',
                xbd: 'application/vnd.fujixerox.docuworks.binder',
                xbm: 'image/x-xbitmap',
                xdf: 'application/xcap-diff+xml',
                xdm: 'application/vnd.syncml.dm+xml',
                xdp: 'application/vnd.adobe.xdp+xml',
                xdssc: 'application/dssc+xml',
                xdw: 'application/vnd.fujixerox.docuworks',
                xenc: 'application/xenc+xml',
                xer: 'application/patch-ops-error+xml',
                xfdf: 'application/vnd.adobe.xfdf',
                xfdl: 'application/vnd.xfdl',
                xht: 'application/xhtml+xml',
                xhtml: 'application/xhtml+xml',
                xhvml: 'application/xv+xml',
                xif: 'image/vnd.xiff',
                xla: 'application/vnd.ms-excel',
                xlam: 'application/vnd.ms-excel.addin.macroenabled.12',
                xlc: 'application/vnd.ms-excel',
                xlf: 'application/x-xliff+xml',
                xlm: 'application/vnd.ms-excel',
                xls: 'application/vnd.ms-excel',
                xlsb: 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
                xlsm: 'application/vnd.ms-excel.sheet.macroenabled.12',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                xlt: 'application/vnd.ms-excel',
                xltm: 'application/vnd.ms-excel.template.macroenabled.12',
                xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
                xlw: 'application/vnd.ms-excel',
                xm: 'audio/xm',
                xml: 'application/xml',
                xo: 'application/vnd.olpc-sugar',
                xop: 'application/xop+xml',
                xpi: 'application/x-xpinstall',
                xpl: 'application/xproc+xml',
                xpm: 'image/x-xpixmap',
                xpr: 'application/vnd.is-xpr',
                xps: 'application/vnd.ms-xpsdocument',
                xpw: 'application/vnd.intercon.formnet',
                xpx: 'application/vnd.intercon.formnet',
                xsl: 'application/xml',
                xslt: 'application/xslt+xml',
                xsm: 'application/vnd.syncml+xml',
                xspf: 'application/xspf+xml',
                xul: 'application/vnd.mozilla.xul+xml',
                xvm: 'application/xv+xml',
                xvml: 'application/xv+xml',
                xwd: 'image/x-xwindowdump',
                xyz: 'chemical/x-xyz',
                xz: 'application/x-xz',
                yang: 'application/yang',
                yin: 'application/yin+xml',
                z1: 'application/x-zmachine',
                z2: 'application/x-zmachine',
                z3: 'application/x-zmachine',
                z4: 'application/x-zmachine',
                z5: 'application/x-zmachine',
                z6: 'application/x-zmachine',
                z7: 'application/x-zmachine',
                z8: 'application/x-zmachine',
                zaz: 'application/vnd.zzazz.deck+xml',
                zip: 'application/zip',
                zir: 'application/vnd.zul',
                zirz: 'application/vnd.zul',
                zmm: 'application/vnd.handheld-entertainment+xml',
            };
            return mimeType[ext];
        }, getMimeTypeByFile: function (filename) {
            return this.getMimeTypeByExt(this.extname(filename));
        }, extname: function (filename) {
            if (filename.lastIndexOf('.') > 0) {
                return filename.substring(filename.lastIndexOf('.') + 1);
            }
        },
    };
    exports(MOD_NAME, uploadMoreObj);
});