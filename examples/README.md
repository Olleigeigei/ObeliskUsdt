## ObeliskUSDT 示例目录（当前版本）

本目录提供与当前项目契约一致的最小示例，便于按现有接口快速接入。

### 文件说明

- `backend/host-init.ts`：宿主后端初始化 `ObeliskUSDT` 示例（挂载路由、启动扫描器、回调发放）
- `backend/payment-api-client.ts`：宿主服务端调用支付接口的示例客户端
- `web/create-and-poll.ts`：网页端创建订单并轮询状态的示例
- `bot/create-order-with-qr.ts`：机器人侧创建订单并发送二维码的示例

### 使用原则

1. 这些示例用于说明接入流程，不绑定前端框架和 UI 库。
2. 业务字段以当前 `src/types.ts` 与 API 路由为准。
3. 宿主业务发放必须在 `onOrderConfirmed` 中实现幂等。
4. 创建订单接口默认要求签名，宿主需要配置 `apiAuthToken` 并在请求中携带 `signature`。
5. 创建订单成功后返回 `orderToken`，查询/取消订单必须携带 `orderToken`。
