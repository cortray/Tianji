export default defineAppConfig({
  pages: [
    'pages/overview/index',
    'pages/bazi/index',
    'pages/chat/index',
    'pages/settings/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '天机 AI',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f9fafb'
  },
  tabBar: {
    color: '#9ca3af',
    selectedColor: '#4f46e5',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/overview/index', text: '概览' },
      { pagePath: 'pages/bazi/index', text: '排盘' },
      { pagePath: 'pages/chat/index', text: '对话' },
      { pagePath: 'pages/settings/index', text: '设置' }
    ]
  }
})
