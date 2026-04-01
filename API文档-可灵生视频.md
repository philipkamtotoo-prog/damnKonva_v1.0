API文档-可灵



## 查询任务（单个）

GET`/v1/videos/image2video/{id}`

### 请求头

Content-Typestring必填默认值 application/json

数据交换格式

Authorizationstring必填

鉴权信息，参考接口鉴权

### 路径参数

task_idstring可选

图生视频的任务 ID

- 请求路径参数，直接将值填写在请求路径中

- 与 external_task_id 两种查询方式二选一

external_task_idstring可选

图生视频的自定义任务 ID

- 创建任务时填写的 external_task_id

- 与 task_id 两种查询方式二选一





curl --request GET \
  --url https://api-beijing.klingai.com/v1/videos/image2video/{task_id} \
  --header 'Authorization: Bearer <token>'

{
  "code": 0, // 错误码；具体定义见错误码
  "message": "string", // 错误信息
  "request_id": "string", // 请求ID，系统生成，用于跟踪请求、排查问题
  "data": {
    "task_id": "string", // 任务ID，系统生成
    "task_status": "string", // 任务状态，枚举值：submitted（已提交）、processing（处理中）、succeed（成功）、failed（失败）
    "task_status_msg": "string", // 任务状态信息，当任务失败时展示失败原因（如触发平台的内容风控等）
    "watermark_info": {
      "enabled": boolean
    },
    "task_result": {
      "videos": [
        {
          "id": "string", // 生成的视频ID；全局唯一
          "url": "string", // 生成视频的URL（请注意，为保障信息安全，生成的图片/视频会在30天后被清理，请及时转存）
          "watermark_url": "string", // 含水印视频下载URL，防盗链格式
          "duration": "string" // 视频总时长，单位s
        }
      ]
    },
    "task_info": { // 任务创建时的参数信息
      "external_task_id": "string" // 客户自定义任务ID
    },
    "final_unit_deduction": "string", // 任务最终扣减积分数值
    "created_at": 1722769557708, // 任务创建时间，Unix时间戳、单位ms
    "updated_at": 1722769557708 // 任务更新时间，Unix时间戳、单位ms
  }
}



## 查询任务（列表）

GET`/v1/videos/image2video`

### 请求头

Content-Typestring必填默认值 application/json

数据交换格式

Authorizationstring必填

鉴权信息，参考接口鉴权

### 查询参数

pageNumint可选默认值 1

页码

- 取值范围：[1, 1000]

pageSizeint可选默认值 30

每页数据量

- 取值范围：[1, 500]

curl --request GET \
  --url 'https://api-beijing.klingai.com/v1/videos/image2video?pageNum=1&pageSize=30' \
  --header 'Authorization: Bearer <token>'



{
  "code": 0, // 错误码；具体定义见错误码
  "message": "string", // 错误信息
  "request_id": "string", // 请求ID，系统生成，用于跟踪请求、排查问题
  "data": [
    {
      "task_id": "string", // 任务ID，系统生成
      "task_status": "string", // 任务状态，枚举值：submitted（已提交）、processing（处理中）、succeed（成功）、failed（失败）
      "task_status_msg": "string", // 任务状态信息，当任务失败时展示失败原因（如触发平台的内容风控等）
      "task_info": { // 任务创建时的参数信息
        "external_task_id": "string" // 客户自定义任务ID
      },
      "task_result": {
        "videos": [
          {
            "id": "string", // 生成的视频ID；全局唯一
            "url": "string", // 生成视频的URL（请注意，为保障信息安全，生成的图片/视频会在30天后被清理，请及时转存）
            "watermark_url": "string", // 含水印视频下载URL，防盗链格式
            "duration": "string" // 视频总时长，单位s
          }
        ]
      },
      "watermark_info": {
        "enabled": boolean
      },
      "final_unit_deduction": "string", // 任务最终扣减积分数值
      "created_at": 1722769557708, // 任务创建时间，Unix时间戳、单位ms
      "updated_at": 1722769557708 // 任务更新时间，Unix时间戳、单位ms
    }
  ]
}





## 创建任务

POST`/v1/videos/image2video`

💡

请您注意，为了保持命名统一，原 model 字段变更为 model_name 字段，未来请您使用该字段来指定需要调用的模型版本。  
同时，我们保持了行为上的向前兼容，如您继续使用原 model 字段，不会对接口调用有任何影响、不会有任何异常，等价于 model_name 为空时的默认行为（即调用V1模型）

### 请求头

Content-Typestring必填默认值 application/json

数据交换格式

Authorizationstring必填

鉴权信息，参考接口鉴权

### 请求体

model_namestring可选默认值 kling-v1

模型名称

枚举值：kling-v1kling-v1-5kling-v1-6kling-v2-masterkling-v2-1kling-v2-1-masterkling-v2-5-turbokling-v2-6kling-v3

imagestring可选

参考图像

- 支持传入图片 Base64 编码或图片 URL（确保可访问）

- 注意：请确保您传递的所有图像数据参数均采用Base64编码格式。若您使用 Base64 方式，请不要在 Base64 编码字符串前添加任何前缀（如 `data:image/png;base64,`），直接传递 Base64 编码后的字符串即可。

- 正确的 Base64 编码参数：

```plaintext
iVBORw0KGgoAAAANSUhEUgAAAAUA...
```

- 错误的 Base64 编码参数（包含 data: 前缀）：

```plaintext
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
```

- 图片格式支持 `.jpg / .jpeg / .png`

- 图片文件大小不能超过 10MB，图片宽高尺寸不小于 300px，图片宽高比介于 1:2.5 ~ 2.5:1 之间

- image 参数与 image_tail 参数至少二选一，二者不能同时为空

不同模型版本、视频模式支持范围不同，详见[能力地图](https://app.klingai.com/cn/dev/document-api/apiReference/model/videoModels)

image_tailstring可选

参考图像 - 尾帧控制

- 支持传入图片 Base64 编码或图片 URL（确保可访问）

- 注意：若您使用 Base64 方式，请不要在 Base64 编码字符串前添加任何前缀（如 `data:image/png;base64,`），直接传递 Base64 编码后的字符串即可。

- 图片格式支持 `.jpg / .jpeg / .png`

- 图片文件大小不能超过 10MB，图片宽高尺寸不小于 300px

- image 参数与 image_tail 参数至少二选一，二者不能同时为空

- image_tail 参数、dynamic_masks/static_mask 参数、camera_control 参数三选一，不能同时使用

不同模型版本、视频模式支持范围不同，详见[能力地图](https://app.klingai.com/cn/dev/document-api/apiReference/model/videoModels)





# 多图参考生视频

---

## 创建任务

POST`/v1/videos/multi-image2video`

基于多张参考图片（元素）生成视频。

### 请求头

Content-Typestring必填默认值 application/json

数据交换格式

Authorizationstring必填

鉴权信息，参考接口鉴权

### 请求体

model_namestring可选默认值 kling-v1-6

模型名称

枚举值：kling-v1-6

image_listarray必填

参考图片列表

- 最多支持 4 张图片，用 key:value 承载，如下：

```json
"image_list":[
  { "image":"image_url" },
  { "image":"image_url" },
  { "image":"image_url" },
  { "image":"image_url" }
]
```

- API 端无裁剪逻辑，请直接上传已选主体后的图片

- 支持传入图片 Base64 编码或图片 URL（确保可访问）

- 注意：若您使用 Base64 方式，请不要在 Base64 编码字符串前添加任何前缀（如 `data:image/png;base64,`），直接传递 Base64 编码后的字符串即可。

- 正确的 Base64 编码参数：

```plaintext
iVBORw0KGgoAAAANSUhEUgAAAAUA...
```

- 错误的 Base64 编码参数（包含 data: 前缀）：

```plaintext
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
```

- 图片格式支持 .jpg / .jpeg / .png

- 图片文件大小不能超过 10MB，图片宽高尺寸不小于 300px，图片宽高比介于 1:2.5 ~ 2.5:1 之间

▾隐藏 子属性

imagestring必填

图片 URL 或 Base64 字符串

promptstring必填

正向文本提示词

- 不能超过 2500 个字符

negative_promptstring可选

负向文本提示词

- 不能超过 2500 个字符

modestring可选默认值 std

生成视频的模式

枚举值：stdpro

- 其中std：标准模式（标准），基础模式，性价比高

- 其中pro：专家模式（高品质），高表现模式，生成视频质量更佳

不同模型版本、视频模式支持范围不同，详见 [能力地图](https://app.klingai.com/cn/dev/document-api/apiReference/model/videoModels)

durationstring可选默认值 5

生成视频时长，单位 s

枚举值：510

aspect_ratiostring可选默认值 16:9

生成图片的画面纵横比（宽:高）

枚举值：16:99:161:1

watermark_infoobject可选

是否同时生成含水印的结果

- 通过enabled参数定义，具体格式如下：

```json
 "watermark_info": { "enabled": boolean } 
```

- true 为生成，false 为不生成

- 暂不支持自定义水印

callback_urlstring可选

本次任务结果回调通知地址，如果配置，服务端会在任务状态发生变更时主动通知

- 具体通知的消息 schema 见 [Callback 协议](https://app.klingai.com/cn/dev/document-api/apiReference/callbackProtocol)

external_task_idstring可选

自定义任务 ID

- 用户自定义任务 ID，传入不会覆盖系统生成的任务 ID，但支持通过该 ID 进行任务查询

- 请注意，单用户下需要保证唯一性

cURL

复制折叠

```bash
curl --request POST \
  --url https://api-beijing.klingai.com/v1/videos/multi-image2video \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{    "model_name": "kling-v1-6",    "image_list": [      { "image": "https://p1-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/dog.png" },      { "image": "https://p1-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/dog_cloth.png" }    ],    "prompt": "一只白色比熊穿着东北红色花棉袄，舔自己的手",    "negative_prompt": "",    "mode": "pro",    "duration": "5",    "aspect_ratio": "16:9",    "callback_url": "",    "external_task_id": ""  }'
```

200

复制折叠

```json
{
  "code": 0, // 错误码；具体定义见错误码
  "message": "string", // 错误信息
  "request_id": "string", // 请求ID，系统生成，用于跟踪请求、排查问题
  "data": {
    "task_id": "string", // 任务ID，系统生成
    "task_status": "string", // 任务状态，枚举值：submitted（已提交）、processing（处理中）、succeed（成功）、failed（失败）
    "created_at": 1722769557708, // 任务创建时间，Unix时间戳、单位ms
    "updated_at": 1722769557708 //任务更新时间，Unix时间戳、单位ms
  }
}
```

---

## 查询任务（单个）

GET`/v1/videos/multi-image2video/{id}`

### 请求头

Content-Typestring必填默认值 application/json

数据交换格式

Authorizationstring必填

鉴权信息，参考接口鉴权

### 路径参数

task_idstring可选

多图参考生视频的任务 ID

- 请求路径参数，直接将值填写在请求路径中

- 与 external_task_id 两种查询方式二选一

external_task_idstring可选

多图参考生视频的自定义任务 ID

- 请求路径参数，直接将值填写在请求路径中

- 创建任务时填写的 external_task_id，与 task_id 两种查询方式二选一

cURL

复制折叠

```bash
curl --request GET \
  --url https://api-beijing.klingai.com/v1/videos/multi-image2video/{task_id} \
  --header 'Authorization: Bearer <token>'
```

200

复制折叠

```json
{
  "code": 0, // 错误码；具体定义见错误码
  "message": "string", // 错误信息
  "request_id": "string", // 请求ID，系统生成，用于跟踪请求、排查问题
  "data": {
    "task_id": "string", // 任务ID，系统生成
    "task_status": "string", // 任务状态，枚举值：submitted（已提交）、processing（处理中）、succeed（成功）、failed（失败）
    "task_status_msg": "string", // 任务状态信息，当任务失败时展示失败原因（如触发平台的内容风控等）
    "task_info": { //任务创建时的参数信息
      "external_task_id": "string" //客户自定义任务ID
    },
    "task_result": {
      "videos": [
        {
          "id": "string", // 生成的视频ID；全局唯一
          "url": "string", // 生成视频的URL（请注意，为保障信息安全，生成的图片/视频会在30天后被清理，请及时转存）
          "watermark_url": "string", // 含水印视频下载URL，防盗链格式
          "duration": "string" //视频总时长，单位s
        }
      ]
    },
    "watermark_info": {
      "enabled": boolean
    },
    "final_unit_deduction": "string", // 任务最终扣减积分数值
    "created_at": 1722769557708, // 任务创建时间，Unix时间戳、单位ms
    "updated_at": 1722769557708 //任务更新时间，Unix时间戳、单位ms
  }
}
```

---

## 查询任务（列表）

GET`/v1/videos/multi-image2video`

### 请求头

Content-Typestring必填默认值 application/json

数据交换格式

Authorizationstring必填

鉴权信息，参考接口鉴权

### 查询参数

pageNumint可选默认值 1

页码

- 取值范围：[1, 1000]

pageSizeint可选默认值 30

每页数据量

- 取值范围：[1, 500]
