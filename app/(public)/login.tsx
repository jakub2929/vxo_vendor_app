import { router } from 'expo-router';
import { Screen } from '@/components';
import { EmailAuthForm } from '@/features/auth/EmailAuthForm';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const handleSubmit = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    router.push({ pathname: '/(public)/otp', params: { email: normalizedEmail } });
  };

  return (
    <Screen noPadding>
      <EmailAuthForm
        title="Login to Your Account"
        buttonLabel="Sign in"
        footerText="Don't have an account?"
        footerLinkText="Sign up"
        footerLinkHref="/(public)/sign-up"
        onSubmit={handleSubmit}
      />
    </Screen>
  );
}