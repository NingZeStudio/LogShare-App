<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import WafBlockDialog from '@/components/ui/WafBlockDialog.vue'
import { initFileAssociation, incomingFiles } from '@/lib/file-association'
import { initNativeShare } from '@/lib/native-share'
import { toast } from '@/lib/toast'

const router = useRouter()

// 当前是否为底部导航的顶级 tab 页（首页 / 历史 / 设置，见 router meta.tab）
const isTabPage = computed(() => router.currentRoute.value.meta.tab === true)

// 取消 JVM 崩溃监听的订阅
let unsubCrash: (() => void) | null = null

// 外部日志入口，两端各一条、只启动一次监听，最终都汇入同一个 incomingFiles 队列：
// - 桌面端：文件关联（双击 .log / .logs）
// - Android：系统分享（其他 App 分享日志给 LogShare）
onMounted(() => {
  initFileAssociation()
  void initNativeShare()

  // JVM 崩溃自动检查（实验性，仅桌面端）：
  // 监听到新崩溃日志 → 读入内容 → 汇入 incomingFiles，由首页接手分析
  const api = window.logshareAPI
  if (api?.onCrashDetected) {
    unsubCrash = api.onCrashDetected(async (file) => {
      const res = await api.crashRead(file.path)
      if (!res.success || typeof res.content !== 'string') {
        toast.warning(`检测到崩溃日志：${file.name}`)
        return
      }
      incomingFiles.value.push({
        name: res.name || file.name,
        path: file.path,
        size: res.size ?? file.size,
        content: res.content
      })
      toast.warning(`检测到崩溃日志 ${file.name}，已载入待分析`)
    })
  }
})

onUnmounted(() => {
  unsubCrash?.()
})

// 有文件被推送进来但当前不在首页时，先切回首页——文件由 HomeView 负责消费
// 注意：必须是 deep 监听。ref([]) 的 push 不会改变 .value 引用，
// 非 deep 的 watch 收不到通知（见 HomeView 同处说明）。
watch(incomingFiles, (files) => {
  if (files.length > 0 && router.currentRoute.value.name !== 'home') {
    router.push('/')
  }
}, { deep: true })
</script>

<template>
  <!-- min-h-dvh：移动端 100vh 会把地址栏高度算进去，导致页面比可视区高出一截 -->
  <div class="min-h-dvh flex flex-col bg-background text-foreground transition-colors duration-500">
    <Header />

    <!-- [&>*]:min-w-0: 消除 flex 子项默认 min-width:auto 引发的长内容横向溢出 -->
    <!-- tab 页在移动端为固定底栏（3.5rem + 安全区）预留空间，避免内容被遮挡 -->
    <main
      class="flex-1 flex flex-col [&>*]:min-w-0"
      :class="isTabPage ? 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0' : ''"
    >
      <RouterView v-slot="{ Component, route }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <!-- 移动端 tab 页由底部导航充当底部 chrome，Footer 让位；子页面与桌面端照常显示 -->
    <Footer :class="{ 'hidden md:block': isTabPage }" />
    <BottomNav />
    <ToastHost />
    <!-- WAF 拦截由 lib/api.ts 统一写入状态，这里全局消费一次即可 -->
    <WafBlockDialog />
  </div>
</template>

<style>
/* 页面级路由过渡：淡入 + 微幅上滑（0.18s 回弹微动效） */
.page-enter-active {
  transition: opacity 0.18s cubic-bezier(0.34, 1.7, 0.64, 1), transform 0.18s cubic-bezier(0.34, 1.7, 0.64, 1);
}
.page-leave-active {
  transition: opacity 0.12s ease-in, transform 0.12s ease-in;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
