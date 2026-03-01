import React from 'react'
import NanakoPetController from './NanakoPetController'
import GridWorldSimulator from './GridWorldSimulator'

function App() {
  return (
    <>
      {/* 默认显示宠物控制器，你可以根据需要切换为 <GridWorldSimulator /> */}
      <NanakoPetController />
    </>
  )
}

export default App
