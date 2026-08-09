const icons = require('./icons.gen.js')

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/overview/index', text: '概览', icon: icons.grid.normal, iconActive: icons.grid.active },
      { pagePath: '/pages/bazi/index', text: '排盘', icon: icons.calendar3.normal, iconActive: icons.calendar3.active },
      { pagePath: '/pages/chat/index', text: '对话', icon: icons['chat-dots'].normal, iconActive: icons['chat-dots'].active },
      { pagePath: '/pages/settings/index', text: '设置', icon: icons.gear.normal, iconActive: icons.gear.active }
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
