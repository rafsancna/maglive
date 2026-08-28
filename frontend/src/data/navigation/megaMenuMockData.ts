import type { NavigationMockData } from "@/types/navigation";

const image = (src: string, en: string, zh: string) => ({
  src,
  alt: { en, zh },
  width: 1200,
  height: 800,
});

export const megaMenuMockData: NavigationMockData = {
  productCategories: [
    {
      label: { en: "Solar modules", zh: "太阳能组件" },
      description: { en: "High-output modules engineered for long-term yield", zh: "为长期发电量而设计的高功率组件" },
      href: "/products",
      accent: "01",
    },
    {
      label: { en: "Inverters", zh: "逆变器" },
      description: { en: "Grid-ready conversion for every project scale", zh: "适配各种项目规模的并网转换方案" },
      href: "/products",
      accent: "02",
    },
    {
      label: { en: "Energy storage", zh: "储能系统" },
      description: { en: "Flexible storage for resilient energy networks", zh: "为韧性能源网络提供灵活储能" },
      href: "/products",
      accent: "03",
    },
    {
      label: { en: "EV charging", zh: "电动汽车充电" },
      description: { en: "Fast, intelligent charging infrastructure", zh: "快速、智能的充电基础设施" },
      href: "/products",
      accent: "04",
    },
  ],
  featuredProducts: [
    {
      label: { en: "Astra 630", zh: "Astra 630" },
      description: { en: "630 W n-type module for utility-scale efficiency.", zh: "面向大型电站效率的630 W n型组件。" },
      href: "/products",
      tag: { en: "New generation", zh: "新一代产品" },
      image: image("https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=85", "Solar modules in a field", "光伏电站组件"),
    },
    {
      label: { en: "GridCore X", zh: "GridCore X" },
      description: { en: "High-density conversion for demanding sites.", zh: "适用于高要求场景的高密度转换。" },
      href: "/products",
      tag: { en: "Flagship", zh: "旗舰系列" },
      image: image("https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=85", "Wind turbines and energy infrastructure", "风机与能源基础设施"),
    },
  ],
  solutionCategories: [
    { label: { en: "Residential", zh: "住宅能源" }, description: { en: "Energy independence for the places people call home.", zh: "为家庭打造能源自主。" }, href: "/projects" },
    { label: { en: "Commercial & industrial", zh: "工商业能源" }, description: { en: "Predictable power for productive operations.", zh: "为高效运营提供可预测电力。" }, href: "/projects" },
    { label: { en: "Utility scale", zh: "大型电站" }, description: { en: "Bankable systems built for the grid.", zh: "为电网打造可融资的系统。" }, href: "/projects" },
    { label: { en: "Microgrids", zh: "微电网" }, description: { en: "Resilient control across distributed assets.", zh: "协调分布式资产，提升系统韧性。" }, href: "/projects" },
  ],
  featuredSolution: {
    label: { en: "A smarter energy balance", zh: "更智能的能源平衡" },
    description: { en: "Connect generation, storage and demand into one dependable operating picture.", zh: "将发电、储能与负荷连接为可靠统一的运营视图。" },
    href: "/projects",
    kicker: { en: "System thinking", zh: "系统化思维" },
    image: image("https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1400&q=85", "Solar panels at sunset", "日落中的太阳能电池板"),
  },
  cases: [
    {
      label: { en: "Delta solar park", zh: "Delta 光伏电站" },
      description: { en: "Utility solar", zh: "大型光伏" },
      href: "/projects",
      location: { en: "Dhaka, Bangladesh", zh: "孟加拉国·达卡" },
      capacity: { en: "48 MWp", zh: "48 MWp" },
      image: image("https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1000&q=85", "Aerial view of a solar farm", "光伏电站航拍"),
    },
    {
      label: { en: "Rhein rooftop", zh: "Rhein 屋顶项目" },
      description: { en: "Commercial rooftop", zh: "工商业屋顶" },
      href: "/projects",
      location: { en: "Cologne, Germany", zh: "德国·科隆" },
      capacity: { en: "3.2 MWp", zh: "3.2 MWp" },
      image: image("https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1000&q=85", "Solar panels on a modern building", "现代建筑屋顶光伏板"),
    },
    {
      label: { en: "Northline microgrid", zh: "Northline 微电网" },
      description: { en: "Storage microgrid", zh: "储能微电网" },
      href: "/projects",
      location: { en: "Queensland, Australia", zh: "澳大利亚·昆士兰" },
      capacity: { en: "12 MWh", zh: "12 MWh" },
      image: image("https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1000&q=85", "Energy infrastructure at golden hour", "金色时刻的能源基础设施"),
    },
  ],
  news: [
    {
      label: { en: "Maglive opens a new chapter in intelligent energy", zh: "Maglive 开启智能能源新篇章" },
      description: { en: "Company news", zh: "公司新闻" },
      href: "/news",
      date: { en: "18 Jun 2025", zh: "2025年6月18日" },
      category: { en: "Company", zh: "公司动态" },
      image: image("https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=900&q=85", "Solar panels and sky", "太阳能电池板与天空"),
    },
    {
      label: { en: "What resilient grids need next", zh: "韧性电网的下一步" },
      description: { en: "Industry insight", zh: "行业洞察" },
      href: "/news",
      date: { en: "02 May 2025", zh: "2025年5月2日" },
      category: { en: "Insights", zh: "行业观点" },
      image: image("https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=900&q=85", "Solar farm from above", "俯瞰光伏电站"),
    },
    {
      label: { en: "Designing for a more flexible future", zh: "为更灵活的未来而设计" },
      description: { en: "Technology", zh: "技术前沿" },
      href: "/news",
      date: { en: "21 Mar 2025", zh: "2025年3月21日" },
      category: { en: "Technology", zh: "技术" },
      image: image("https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=900&q=85", "Renewable energy infrastructure", "可再生能源基础设施"),
    },
  ],
  documents: [
    { label: { en: "Product datasheets", zh: "产品数据表" }, description: { en: "Specifications at a glance", zh: "快速查阅产品规格" }, href: "/downloads" },
    { label: { en: "Brochures", zh: "产品手册" }, description: { en: "Solutions and applications", zh: "解决方案与应用" }, href: "/downloads" },
    { label: { en: "Certificates", zh: "认证证书" }, description: { en: "Quality and compliance", zh: "质量与合规" }, href: "/downloads" },
    { label: { en: "Warranty documents", zh: "质保文件" }, description: { en: "Support beyond delivery", zh: "交付后的持续支持" }, href: "/downloads" },
  ],
  services: [
    { label: { en: "Technical support", zh: "技术支持" }, description: { en: "Answers from our specialists", zh: "专家团队解答问题" }, href: "/contact" },
    { label: { en: "Engineering support", zh: "工程支持" }, description: { en: "From concept to commissioning", zh: "从概念到并网调试" }, href: "/contact" },
    { label: { en: "After-sales care", zh: "售后服务" }, description: { en: "Keep every system performing", zh: "保障系统持续高效运行" }, href: "/contact" },
    { label: { en: "Training", zh: "培训服务" }, description: { en: "Build capability in your team", zh: "提升团队专业能力" }, href: "/contact" },
  ],
};
