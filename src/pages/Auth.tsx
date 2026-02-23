import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Mail, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { isSupabaseConfigured, signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/lib/supabase'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleEmailAuth = async () => {
    setError('')
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error: signInError } = await signInWithEmail(email, password)
        if (signInError) throw signInError
      } else {
        const { error: signUpError } = await signUpWithEmail(email, password)
        if (signUpError) throw signUpError
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setError('')
    setLoading(true)
    try {
      const { error: googleError } = await signInWithGoogle()
      if (googleError) throw googleError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول عبر Google')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="glass w-full max-w-md">
        <CardHeader className="space-y-2">
          <Badge variant="secondary" className="w-fit">Auth</Badge>
          <CardTitle className="text-2xl">تسجيل الدخول للنظام</CardTitle>
          <p className="text-sm text-muted-foreground">سجّل عبر Google أو البريد الإلكتروني للوصول إلى بياناتك الشخصية</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isSupabaseConfigured() && (
            <div className="text-sm text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2">
              إعدادات Supabase غير مكتملة. فعّل مفاتيح Supabase أولاً.
            </div>
          )}

          <Button variant="outline" className="w-full gap-2" onClick={handleGoogleAuth} disabled={loading || !isSupabaseConfigured()}>
            <LogIn className="w-4 h-4" />
            الدخول عبر Google
          </Button>

          <div className="text-xs text-center text-muted-foreground">أو</div>

          <Input
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            dir="ltr"
          />
          <Input
            placeholder="كلمة المرور"
            value={password}
            onChange={e => setPassword(e.target.value)}
            type="password"
            dir="ltr"
          />

          {error && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-md p-2">{error}</div>}

          <Button className="w-full gap-2" onClick={handleEmailAuth} disabled={loading || !isSupabaseConfigured()}>
            {mode === 'signin' ? <Mail className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {loading ? 'جاري المعالجة...' : mode === 'signin' ? 'دخول بالبريد الإلكتروني' : 'إنشاء حساب بالبريد الإلكتروني'}
          </Button>

          <Button
            variant="ghost"
            className="w-full text-xs"
            onClick={() => setMode(prev => (prev === 'signin' ? 'signup' : 'signin'))}
          >
            {mode === 'signin' ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب بالفعل؟ تسجيل الدخول'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
