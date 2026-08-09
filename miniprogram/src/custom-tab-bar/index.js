const icons = require('./icons.gen.js')

// Animated Tab Bar 风格：每个 tab 专属色（天机适配：金/紫/青/粉）
Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/overview/index',
        text: '概览',
        icon: icons.grid.normal,
        iconActive: icons.grid.active,
        color: '#e8b44a',
        colorSoft: 'rgba(232, 180, 74, 0.4)'
      },
      {
        pagePath: '/pages/bazi/index',
        text: '排盘',
        icon: icons.calendar3.normal,
        iconActive: icons.calendar3.active,
        color: '#8b5cf6',
        colorSoft: 'rgba(139, 92, 246, 0.4)'
      },
      {
        pagePath: '/pages/chat/index',
        text: '对话',
        icon: icons['chat-dots'].normal,
        iconActive: icons['chat-dots'].active,
        color: '#38bdf8',
        colorSoft: 'rgba(56, 189, 248, 0.4)'
      },
      {
        pagePath: '/pages/settings/index',
        text: '设置',
        icon: icons.gear.normal,
        iconActive: icons.gear.active,
        color: '#f472b6',
        colorSoft: 'rgba(244, 114, 182, 0.4)'
      }
    ]
  },
  lifetimes: {
    attached() {
      this.syncSelected()
    }
  },
  pageLifetimes: {
    show() {
      this.syncSelected()
    }
  },
  methods: {
    syncSelected() {
      const pages = getCurrentPages()
      const cur = pages[pages.length - 1]
      const route = cur && cur.route ? `/${cur.route}` : ''
      const idx = this.data.list.findIndex((t) => t.pagePath === route)
      if (idx >= 0 && idx !== this.data.selected) {
        this.setData({ selected: idx })
      }
    },
    switchTab(e) {
      const idx = e.currentTarget.dataset.index
      if (idx === this.data.selected) return
      wx.switchTab({ url: this.data.list[idx].pagePath })
    }
  }
})
