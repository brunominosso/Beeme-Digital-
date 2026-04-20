'use client'

import { useState, useEffect } from 'react'
import HomeMobile from './HomeMobile'
import HomeDashboard from './HomeDashboard'
import HomeDesigner from './HomeDesigner'
import HomeSocialMedia from './HomeSocialMedia'
import HomeFinanceiro from './HomeFinanceiro'
import type { Client, Task, Meeting, Profile, Post, Invoice, Expense, PaymentSchedule } from '@/types/database'

type ScheduleWithClient = PaymentSchedule & { clients: { name: string; status: string } | null }

interface Props {
  profile: Profile
  myClients: Client[]
  allClients: Client[]
  allTasks: Task[]
  myTasks: Task[]
  upcomingMeetings: Meeting[]
  allProfiles: Pick<Profile, 'id' | 'name' | 'avatar_color' | 'role'>[]
  allPosts: Post[]
  myPosts: Post[]
  allInvoices: Invoice[]
  allExpenses: Expense[]
  paymentSchedules: ScheduleWithClient[]
  todayStr: string
  tomorrowStr: string
  weekEndStr: string
}

export default function DashboardHomeSwitch(props: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const check = () => {
      const narrowScreen = window.screen.width < 768
      const narrowViewport = window.innerWidth < 1024
      const isTouch = navigator.maxTouchPoints > 0
      setIsMobile(narrowViewport || (isTouch && narrowScreen))
    }
    check()
    setReady(true)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Avoid flash: render nothing until client detects device
  if (!ready) return null

  const { profile, myClients, allClients, myTasks, allTasks, upcomingMeetings,
          allProfiles, allPosts, myPosts, allInvoices, allExpenses,
          paymentSchedules, todayStr, tomorrowStr, weekEndStr } = props

  const sharedProps = { profile, myClients, allTasks: myTasks, upcomingMeetings, todayStr, tomorrowStr, weekEndStr }

  if (isMobile) {
    return (
      <HomeMobile
        profile={profile}
        myClients={myClients}
        allTasks={myTasks}
        upcomingMeetings={upcomingMeetings}
        todayStr={todayStr}
        tomorrowStr={tomorrowStr}
        allProfiles={allProfiles}
        allPosts={allPosts}
      />
    )
  }

  switch (profile.role) {
    case 'designer':
      return <HomeDesigner {...sharedProps} myPosts={myPosts} allClients={allClients} />
    case 'social_media':
      return <HomeSocialMedia {...sharedProps} myPosts={myPosts} allClients={allClients} weekEndStr={weekEndStr} />
    case 'financeiro':
      return <HomeFinanceiro {...sharedProps} allInvoices={allInvoices} allExpenses={allExpenses} paymentSchedules={paymentSchedules} />
    default:
      return <HomeDashboard {...sharedProps} allProfiles={allProfiles} allClients={allClients} allPosts={allPosts} allTasks={allTasks} />
  }
}
