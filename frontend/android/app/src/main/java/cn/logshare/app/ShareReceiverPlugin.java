package cn.logshare.app;

import android.app.Activity;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * 接收来自其他 App 的分享（ACTION_SEND / SEND_MULTIPLE / VIEW）。
 *
 * 为什么要有队列：
 * 分享可能在 Web 层还没注册监听时就到达（冷启动场景：用户从文件管理器分享，
 * 系统先拉起本应用）。此时若直接推事件就会丢失，所以原生侧先入队，
 * Web 层就绪后主动调 getPending() 取走 —— 与桌面端 pendingFiles 的思路一致。
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {

    private static final String TAG = "LogShareShare";

    private static final List<JSObject> PENDING = new ArrayList<>();
    private static ShareReceiverPlugin instance = null;

    @Override
    public void load() {
        instance = this;
        // 插件加载时可能已有积压（冷启动分享），此时 Web 层即将就绪，直接通知
        if (!PENDING.isEmpty()) flushToWeb();
    }

    /** Web 层主动拉取积压的分享内容 */
    @PluginMethod
    public void getPending(PluginCall call) {
        JSArray arr = new JSArray();
        synchronized (PENDING) {
            for (JSObject item : PENDING) arr.put(item);
            PENDING.clear();
        }
        JSObject ret = new JSObject();
        ret.put("items", arr);
        call.resolve(ret);
    }

    /** 由 MainActivity 在收到分享时调用 */
    static void enqueue(JSObject item) {
        synchronized (PENDING) {
            PENDING.add(item);
        }
        if (instance != null) instance.flushToWeb();
    }

    /**
     * 只发出「有新分享」的通知，数据仍由 Web 层调 getPending() 取走。
     * 这样即使事件送达时 JS 尚未挂好回调，内容也不会丢。
     */
    private void flushToWeb() {
        final Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            try {
                notifyListeners("shareReceived", new JSObject());
            } catch (Exception e) {
                Log.w(TAG, "notifyListeners failed", e);
            }
        });
    }
}
