// src/screens/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types'; // Make sure this path is correct
import api from '../api'; // Make sure this path is correct

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'ForgotPassword'>;
};

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();

  const handleSendResetLink = async () => {
    // Open the web page for password reset
    const resetUrl = 'https://vakyasangam-backend.onrender.com/user/auth/forgot-password-page';

    // Check if the link can be opened
    const supported = await Linking.canOpenURL(resetUrl);

    if (supported) {
      await Linking.openURL(resetUrl);
    } else {
      Alert.alert("Error", `Don't know how to open this URL: ${resetUrl}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Forgot Password?</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>Enter your email to receive a password reset link.</Text>
      <TextInput
        label="Email Address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        mode="outlined"
      />
      <Button
        mode="contained"
        onPress={handleSendResetLink}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Send Reset Link
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#F5F5F5' },
  title: { textAlign: 'center', marginBottom: 10 },
  subtitle: { textAlign: 'center', marginBottom: 30, color: '#616161' },
  input: { marginBottom: 20 },
  button: { paddingVertical: 8 },
});

export default ForgotPasswordScreen;