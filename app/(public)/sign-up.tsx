import { router } from 'expo-router';
import { Screen } from '@/components';
import { EmailAuthForm } from '@/features/auth/EmailAuthForm';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
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
        title="Create New Account"
        buttonLabel="Sign up"
        footerText="Already have an account?"
        footerLinkText="Sign in"
        footerLinkHref="/(public)/login"
        onSubmit={handleSubmit}
      />
    </Screen>
  );
}