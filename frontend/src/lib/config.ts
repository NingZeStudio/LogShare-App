export interface NavItem {
  name: string
  path: string
  icon?: string
}

export interface FriendLink {
  name: string
  url: string
  desc?: string
}

export interface SiteConfig {
  name: string
  title: string
  description: string
  url: string
  logoText: string
  beian?: string
  github?: string
  qqGroup?: string
  contactEmail?: string
  navLinks: NavItem[]
  friendLinks: FriendLink[]
}

export const siteConfig: SiteConfig = {
  name: 'LogShare.CN',
  title: 'LogShare.CN - Minecraft 日志分享与分析平台',
  description: '轻松上传、分享和分析 Minecraft/Hytale 服务器日志。AI 智能分析，快速定位问题，提供解决方案。',
  url: 'https://logshare.cn',
  logoText: 'LogShare.CN',
  github: 'https://github.com/NingZeStudio/LogShare-Front-Template',
  qqGroup: 'https://qm.qq.com/q/gZ2El58RVe',
  navLinks: [
    { name: '首页', path: '/' },
    { name: '历史记录', path: '/history' },
    { name: '设置', path: '/settings' },
    { name: '关于', path: '/about' }
  ],
  friendLinks: [
    { name: 'LogShare.CN', url: 'https://logshare.cn', desc: 'Minecraft 日志分享与分析平台' },
    { name: '柠泽资源站', url: 'https://miawa.cn', desc: 'Minecraft 启动器镜像分发平台' },
    { name: 'NexusMC', url: 'https://www.nexusmc.cn', desc: 'Minecraft 服务器社区' },
    { name: 'NingZe Studio', url: 'https://github.com/NingZeStudio', desc: '柠泽工作室开源矩阵' }
  ]
}
