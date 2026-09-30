import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { siteConfig } from '@/lib/config'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      // tab: 移动端底部导航（BottomNav）的顶级页面，仅这三个路由显示底栏
      meta: { title: '首页', tab: true }
    },
    {
      path: '/log/:id',
      name: 'log-view',
      component: () => import('@/views/LogView.vue'),
      meta: { title: '日志详情' }
    },
    {
      path: '/log/:id/ai',
      name: 'log-ai',
      component: () => import('@/views/AiAnalysisView.vue'),
      meta: { title: 'AI 深度分析' }
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/HistoryView.vue'),
      meta: { title: '历史记录', tab: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置', tab: true }
    },
    {
      path: '/knowledge',
      name: 'knowledge',
      component: () => import('@/views/KnowledgeView.vue'),
      meta: { title: '知识库管理' }
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
      meta: { title: '关于' }
    },
    {
      path: '/showcase',
      name: 'showcase',
      component: () => import('@/views/ShowcaseView.vue'),
      meta: { title: '范式展台' }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '404' }
    }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to, _from, next) => {
  const title = (to.meta.title as string) || '页面'
  document.title = `${title} - ${siteConfig.name}`
  next()
})

export default router
