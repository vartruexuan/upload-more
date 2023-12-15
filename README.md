<h1 align="center">uploadMore
</h1>

<a href="https://github.com/layui/layui" rel="nofollow"><img src="https://img.shields.io/badge/layui-^2.8.17-red.svg?maxAge=2592000" alt="Yii Version" data-canonical-src="https://img.shields.io/badge/yii-~2.0.14-red.svg?maxAge=2592000" style="max-width: 100%;"></a>

# 概述
- 多文件上传组件 (支持拖拽排序/预览/拖拽上传)
# 使用
```html
<form class="layui-form layui-form-pane layui-code-item-preview" lay-filter="form-goods">
    <div class="layui-form-item">
        <label class="layui-form-label layui-form-required">商品图片</label>
        <div class="layui-input-inline">
            <!-- 上传组件 -->
            <div id="image-upload"></div>
        <div
    </div>
    </div>
</form>

```
```javascript
layui.config({
    // 生成环境时:前填写固定版本,例如v1.0.1,迭代发版请依次叠加..
    version: true,   // 更新组件缓存，设为true不缓存，也可以设一个固定值
    base: 'assets/module/'
}).extend({
    uploadMore:'uploadMore',
    // 拖拽排序组件
    sortable:'sortable', 
}).use(['uploadMore'],function(){
    var uploadMore = layui.uploadMore;

    // 渲染组件
    var uploadMoreObj= uploadMore.render({
        //容器对象
        elem: null,
        // 限制数量 0 无限制
        maxNum: 5,
        // 上传配置
        upload: {
            // 参考组件 layui.upload <https://layui.dev/docs/2/upload/>
        },
        // 拖拽排序能力配置, false 关闭排序
        sortable: {
            // 参考组件 sortable.js <http://www.sortablejs.com/>
            // 无特殊需求不建议配置
        },
        // 成员操作按钮配置 (默认都有)
        operation: [
            'update', // 编辑
            'preview', // 预览
            'delete', // 删除
        ],
        // 初始化数据
        initValue: [],
        // 数据解析
        parseData: function (res) {
            return {
                "code": res.code, // 状态码（此处按0成功）
                "message": res.msg, // 返回信息
                "fileInfo": res.data.info, // 文件完整信息
                "url": res.data.info.url, // 文件地址
                "mimeType": res.data.info.mimeType, // 文件mime类型
            }
        }
    });
    // 获取文件url地址集合
    var fileUrls = uploadMoreObj.getFileUrls();
    // 获取文件信息集合
    var fileInfos = uploadMoreObj.getFileInfos();

});

```
- 全局配置  `uploadMore.set(opt)`
```javascript
 // 针对上传组件做全局配置
 uploadMore.set({
    parseData: function (res) {
        return {
            "code": res.code, // code 码 (0 成功)
            "msg": res.msg,   // 消息
            "fileInfo": res.data && res.data.info ? res.data.info : null,  // 数据
            "url": res.data && res.data.info ? res.data.info.url : '',// 图片地址
        };
    },
    upload: {
        field: 'file',
        data: {
            type: 'files',
        },
        acceptMime: 'image/*',//限制类型
        url: admin.getApiFullUrl('/index/upload'),//上传地址
        size: 20000,// 限制文件大小
    }
});
```
# 效果
![uploadMore](https://github.com/vartruexuan/upload-more/assets/20641529/2787af46-2b08-4481-9e3d-90ab29d2f5f6)





