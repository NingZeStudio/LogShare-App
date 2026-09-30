package cn.logshare.app;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Capacitor 壳层入口。
 *
 * 在默认 BridgeActivity 之上加了「接收外部分享」能力，对应桌面版的 .log 文件关联：
 * - ACTION_SEND / SEND_MULTIPLE：其他应用「分享」日志给 LogShare
 * - ACTION_VIEW：文件管理器「用其他应用打开」
 * - 无附件的纯文本分享：走 EXTRA_TEXT
 *
 * 读到的内容入队到 ShareReceiverPlugin，由 Web 层取走，
 * 之后走与桌面端完全相同的载入流程（incomingFiles → HomeView）。
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "LogShareShare";

    /** 单次分享最多处理多少个文件（对齐前端多文件上限，避免超大 intent 拖垮内存） */
    private static final int MAX_SHARED_FILES = 20;
    /** 单文件读取上限 12 MiB：与 LogShare 服务端「解压后总量 ≤12MB」的限制对齐 */
    private static final int MAX_CHARS_PER_FILE = 12 * 1024 * 1024;
    private static final String FALLBACK_NAME = "shared.log";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // registerPlugin 必须在 super.onCreate 之前，否则 Bridge 初始化时插件尚未注册
        registerPlugin(ShareReceiverPlugin.class);
        super.onCreate(savedInstanceState);
        consumeIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // singleTask 模式下「应用已运行时收到分享」会走这里
        setIntent(intent);
        consumeIntent(intent);
    }

    private void consumeIntent(Intent intent) {
        if (intent == null) return;
        final String action = intent.getAction();
        if (action == null) return;

        if (Intent.ACTION_SEND.equals(action)) {
            Uri uri = firstStream(intent);
            if (uri != null) {
                emitUri(uri);
            } else {
                // 没有附件，但可能是纯文本分享（从聊天里直接分享日志内容）
                CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
                if (text != null && text.length() > 0) emitText(text.toString(), FALLBACK_NAME);
            }
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            List<Uri> uris = allStreams(intent);
            int limit = Math.min(uris.size(), MAX_SHARED_FILES);
            for (int i = 0; i < limit; i++) emitUri(uris.get(i));
        } else if (Intent.ACTION_VIEW.equals(action)) {
            Uri uri = intent.getData();
            if (uri != null) emitUri(uri);
        }
    }

    @SuppressWarnings("deprecation")
    private Uri firstStream(Intent intent) {
        // 旧 API 在 API 33+ 仍可用，只是标注废弃；minSdk 24 下这样写最简洁
        return intent.getParcelableExtra(Intent.EXTRA_STREAM);
    }

    @SuppressWarnings("deprecation")
    private List<Uri> allStreams(Intent intent) {
        ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
        return uris == null ? new ArrayList<Uri>() : uris;
    }

    private void emitUri(Uri uri) {
        String name = queryDisplayName(uri);
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return;
            emitText(readAll(in), name);
        } catch (Exception e) {
            Log.w(TAG, "读取分享文件失败: " + uri, e);
        }
    }

    private void emitText(String content, String name) {
        JSObject item = new JSObject();
        item.put("name", name);
        item.put("content", content);
        item.put("size", content.getBytes(StandardCharsets.UTF_8).length);
        ShareReceiverPlugin.enqueue(item);
    }

    /** content:// 的 lastPathSegment 常常只是个数字 id，这里查 OpenableColumns 取真实文件名 */
    private String queryDisplayName(Uri uri) {
        if ("content".equals(uri.getScheme())) {
            try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
                if (c != null && c.moveToFirst()) {
                    int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (idx >= 0) {
                        String n = c.getString(idx);
                        if (n != null && !n.isEmpty()) return n;
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "查询文件名失败", e);
            }
        }
        String last = uri.getLastPathSegment();
        return (last == null || last.isEmpty()) ? FALLBACK_NAME : last;
    }

    /** 按字符数上限读取，超出即截断：避免 OOM，服务端本来也会拒绝超大日志 */
    private String readAll(InputStream in) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader =
                new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            char[] buf = new char[8192];
            int total = 0;
            int n;
            while ((n = reader.read(buf)) != -1) {
                total += n;
                if (total > MAX_CHARS_PER_FILE) break;
                sb.append(buf, 0, n);
            }
        }
        return sb.toString();
    }
}
