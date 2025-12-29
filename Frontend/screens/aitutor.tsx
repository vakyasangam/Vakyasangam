import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View as MotiView } from 'moti';

// --- App-wide Color Theme ---
const COLORS = {
  primary: '#FFC72C',
  dark: '#34495E',
  light: '#FDF9F0',
  white: '#FFFFFF',
  grey: '#bdc3c7',
  success: '#2ECC71',
  danger: '#E74C3C',
};

// --- Configuration ---
const PYTHON_API_BASE_URL = "https://ai-turtor-1.onrender.com";

const AVAILABLE_LANGUAGES = [
  { label: 'Sanskrit', value: 'Sanskrit' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'Telugu', value: 'Telugu' },
  { label: 'Marathi', value: 'Marathi' },
  { label: 'Panjabi', value: 'Punjabi' },
  { label: 'Kannada', value: 'Kannada' },
];

// --- Helper function to assign icons to lessons ---
const getIconForLesson = (lessonNumber: number): string => {
  const icons = [
    'chatbubble-ellipses-outline', // Day 1: Greetings
    'list-outline',                // Day 2: Numbers
    'person-outline',              // Day 3: Pronouns
    'help-circle-outline',         // Day 4: Questions
    'time-outline',                // Day 5: Time/Days
    'people-outline',              // Day 6: Family
    'color-palette-outline',       // Day 7: Colors
    'reader-outline',              // Day 8: Sentence Structure
    'newspaper-outline',           // Day 9: Present Tense
    'move-outline',                // Day 10: Prepositions
    'cart-outline',                // Day 11: Shopping
    'fast-food-outline',           // Day 12: Restaurant
    'map-outline',                 // Day 13: Directions
    'game-controller-outline',     // Day 14: Hobbies
    'trophy-outline',              // Day 15: Review
  ];
  return icons[lessonNumber - 1] || 'book-outline';
};

// --- Main Component ---
export default function AiTutorScreen() {
  // State Management
  const [appPhase, setAppPhase] = useState('loading');
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [currentLessonNumber, setCurrentLessonNumber] = useState<number>(1);
  const [activeLessonTitle, setActiveLessonTitle] = useState<string>('');
  const [pickedLanguage, setPickedLanguage] = useState<string | null>(null);
  const [lessonsList, setLessonsList] = useState<{ id: number; title: string; icon: string }[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [totalLessons, setTotalLessons] = useState(0); // Track total lessons count

  const flatListRef = useRef<FlatList>(null);

  // --- Effects ---

  // Effect to load saved progress from storage on initial app start
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const lang = await AsyncStorage.getItem('currentUserLanguage');
        const lessonNumStr = await AsyncStorage.getItem('currentLessonNumber');

        if (lang) {
          setSelectedLanguage(lang);
          setCurrentLessonNumber(lessonNumStr ? parseInt(lessonNumStr, 10) : 1);
          setAppPhase('lesson_overview');
        } else {
          setAppPhase('language_selection');
        }
      } catch (error) {
        console.error("Failed to load progress:", error);
        setAppPhase('language_selection');
      }
    };
    loadProgress();
  }, []);

  // Effect to fetch lessons from the backend whenever the selected language changes
  useEffect(() => {
    const fetchLessons = async (language: string | null) => {
      if (!language) return;

      setLessonsLoading(true);
      try {
        const response = await fetch(`${PYTHON_API_BASE_URL}/lessons?language=${language}`);

        // Check if response is OK and likely JSON
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          const formattedLessons = data.lessons.map((lesson: any) => ({
            id: lesson.number,
            title: lesson.title,
            icon: getIconForLesson(lesson.number),
          }));

          if (formattedLessons.length > 0) {
            setLessonsList(formattedLessons);
            setTotalLessons(formattedLessons.length);
          } else {
            console.warn("Backend returned empty lessons list. Using fallback.");
            throw new Error("Empty lessons list"); // Trigger catch block for fallback
          }
        } else {
          console.warn("Backend returned non-JSON or error for lessons. Using fallback.");
          throw new Error("Invalid backend response");
        }
      } catch (error) {
        console.warn("Failed to fetch lessons (using fallback):", error);
        // Fallback to hardcoded lessons if backend fails or returns empty
        const fallbackLessons = Array.from({ length: 15 }, (_, i) => ({
          id: i + 1,
          title: `Lesson ${i + 1}: ${[
            'Greetings & Basics', 'Numbers & Counting', 'Common Pronouns',
            'Asking Questions', 'Time & Days', 'Family & Friends',
            'Colors & Shapes', 'Sentence Structure', 'Present Tense',
            'Prepositions', 'Shopping Terms', 'At the Restaurant',
            'Asking Directions', 'Hobbies & Interests', 'Review & Practice'
          ][i]}`,
          icon: getIconForLesson(i + 1),
        }));
        setLessonsList(fallbackLessons);
        setTotalLessons(15);
      } finally {
        setLessonsLoading(false);
      }
    };

    fetchLessons(selectedLanguage);
  }, [selectedLanguage]);

  // --- Helper Functions ---

  // Check if all lessons are completed
  const areAllLessonsCompleted = () => {
    return totalLessons > 0 && currentLessonNumber > totalLessons;
  };

  // Check if course can be changed (all lessons completed)
  const canChangeLanguage = () => {
    return areAllLessonsCompleted() || !selectedLanguage;
  };

  // --- Handler Functions ---

  const handleSelectLanguage = async () => {
    if (!pickedLanguage) return;
    try {
      await AsyncStorage.setItem('currentUserLanguage', pickedLanguage);
      await AsyncStorage.setItem('currentLessonNumber', '1');
      setSelectedLanguage(pickedLanguage);
      setCurrentLessonNumber(1);
      setAppPhase('lesson_overview');
    } catch (error) {
      console.error("Failed to save language:", error);
    }
  };

  const handleCompleteLesson = async () => {
    try {
      const nextLessonNum = currentLessonNumber + 1;
      await AsyncStorage.setItem('currentLessonNumber', String(nextLessonNum));
      setCurrentLessonNumber(nextLessonNum);

      // Check if this was the last lesson
      if (nextLessonNum > totalLessons) {
        // Course completed!
        Alert.alert(
          "🎉 Congratulations!",
          `You have completed the entire ${selectedLanguage} course! You can now choose a new language to learn.`,
          [{ text: "OK", onPress: () => setAppPhase('lesson_overview') }]
        );
      } else {
        setAppPhase('lesson_overview');
      }
    } catch (error) {
      console.error("Failed to complete lesson:", error);
    }
  };

  const handleStartLesson = async (lesson: { id: number; title: string }) => {
    setActiveLessonTitle(lesson.title);
    setMessages([]);
    setAppPhase('chat_active');
    setLoading(true);
    await sendMessageToPython(`Teach me Lesson ${lesson.id}: ${lesson.title}`, lesson.id);
    setLoading(false);
  };

  const handleResetProgress = async () => {
    if (!canChangeLanguage()) {
      Alert.alert(
        "Cannot Change Language",
        `You must complete all ${totalLessons} lessons in ${selectedLanguage} before you can choose a new language. This helps maintain your learning consistency!`,
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Reset Progress?",
      "This will reset all your progress and allow you to choose a new language. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['currentUserLanguage', 'currentLessonNumber']);
              setSelectedLanguage(null);
              setCurrentLessonNumber(1);
              setTotalLessons(0);
              setAppPhase('language_selection');
              setLessonsList([]);
            } catch (error) {
              console.error("Failed to reset progress:", error);
            }
          }
        }
      ]
    );
  };

  const sendMessageToPython = async (query: string, lessonId: number | null = null) => {
    if (!query.trim()) return;
    const newMessage = { role: "user", text: query };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);
    try {
      const pythonResponse = await fetch(`${PYTHON_API_BASE_URL}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          language: selectedLanguage,
          lesson_to_teach: lessonId,
        }),
      });

      const contentType = pythonResponse.headers.get("content-type");
      if (pythonResponse.ok && contentType && contentType.includes("application/json")) {
        const pythonData = await pythonResponse.json();
        setMessages((prev) => [...prev, { role: "assistant", text: pythonData.response || "No reply" }]);
      } else {
        throw new Error("Invalid chat backend response");
      }

    } catch (error) {
      console.warn("Using offline mode (Backend unreachable):", error);
      // Fallback/Mock response
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          role: "assistant",
          text: `(Offline Mode) That's a great question about ${selectedLanguage}! Since I'm currently unable to reach the AI server, I can't give a specific answer right now. But keep practicing!`
        }]);
      }, 1000); // Fake delay for realism
    } finally {
      setLoading(false);
    }
  };

  // --- Render Functions ---

  const renderLoadingView = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );

  const renderLanguageSelection = () => (
    <ScrollView contentContainerStyle={styles.centerScrollContainer} showsVerticalScrollIndicator={false}>
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 500 }}
        style={{ alignItems: 'center', width: '100%' }}
      >
        <Ionicons name="school-outline" size={80} color={COLORS.primary} />
        <Text style={styles.title}>Welcome to Your AI Tutor</Text>
        <Text style={styles.subtitle}>Start by choosing a language to master.</Text>

        <View style={styles.cardContainer}>
          {AVAILABLE_LANGUAGES.map((lang, index) => (
            <MotiView
              key={lang.value}
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: index * 100, type: 'timing' }}
              style={{ width: '100%' }}
            >
              <TouchableOpacity
                style={[styles.langCard, pickedLanguage === lang.value && styles.langCardSelected]}
                onPress={() => setPickedLanguage(lang.value)}
              >
                <Text style={[styles.langCardText, pickedLanguage === lang.value && styles.langCardTextSelected]}>
                  {lang.label}
                </Text>
                {pickedLanguage === lang.value && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
              </TouchableOpacity>
            </MotiView>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.bigButton, !pickedLanguage && styles.disabledButton]}
          onPress={handleSelectLanguage}
          disabled={!pickedLanguage}
        >
          <Text style={styles.bigButtonText}>Start Learning</Text>
          <Ionicons name="arrow-forward" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </MotiView>
    </ScrollView>
  );

  const renderLessonOverview = () => (
    <View style={styles.overviewContainer}>
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={styles.overviewHeader}
      >
        <Text style={styles.title}>Your {selectedLanguage} Course</Text>
        <Text style={styles.subtitle}>Select a lesson to begin or review.</Text>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.progressText}>Course Progress</Text>
            <Text style={styles.progressText}>{Math.min(currentLessonNumber - 1, totalLessons)} / {totalLessons}</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${totalLessons > 0 ? (Math.min(currentLessonNumber - 1, totalLessons) / totalLessons) * 100 : 0}%` }
              ]}
            />
          </View>
          {areAllLessonsCompleted() && (
            <MotiView from={{ scale: 0 }} animate={{ scale: 1 }}>
              <Text style={styles.completedText}>🎉 Course Completed!</Text>
            </MotiView>
          )}
        </View>
      </MotiView>

      {lessonsLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Fetching lessons...</Text>
        </View>
      ) : lessonsList.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={50} color={COLORS.grey} />
          <Text style={styles.subtitle}>No lessons found for {selectedLanguage}.</Text>
          <Text style={styles.subtitle}>Please check your internet connection.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {lessonsList.map((lesson: { id: number; title: string; icon: string }, index) => {
            const isCompleted = lesson.id < currentLessonNumber;
            const isCurrent = lesson.id === currentLessonNumber;
            const isLocked = lesson.id > currentLessonNumber;
            return (
              <MotiView
                key={lesson.id}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ delay: index * 50 }}
              >
                <TouchableOpacity
                  style={[styles.lessonCard, isLocked && styles.lessonCardLocked, isCurrent && styles.lessonCardCurrent]}
                  disabled={isLocked}
                  onPress={() => handleStartLesson(lesson)}
                >
                  <View style={[styles.iconContainer, isCurrent && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Ionicons name={isLocked ? "lock-closed" : lesson.icon} size={24} color={isLocked ? COLORS.grey : isCurrent ? COLORS.white : COLORS.primary} />
                  </View>
                  <View style={styles.lessonCardTextContainer}>
                    <Text style={[styles.lessonCardTitle, (isLocked || isCurrent) && styles.lessonCardTitleAlt]}>{lesson.title}</Text>
                    {isCompleted && <Text style={styles.lessonCardStatusComplete}>Completed</Text>}
                    {isCurrent && <Text style={styles.lessonCardStatusCurrent}>Start Here!</Text>}
                    {isLocked && <Text style={styles.lessonCardStatusLocked}>Locked</Text>}
                  </View>
                  {!isLocked && <Ionicons name="chevron-forward" size={24} color={isCurrent ? COLORS.white : COLORS.grey} />}
                </TouchableOpacity>
              </MotiView>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.resetButton, !canChangeLanguage() && styles.disabledResetButton]}
        onPress={handleResetProgress}
      >
        <Ionicons name={canChangeLanguage() ? "refresh-outline" : "lock-closed-outline"} size={16} color={canChangeLanguage() ? COLORS.danger : COLORS.grey} />
        <Text style={[styles.resetButtonText, !canChangeLanguage() && styles.disabledResetText]}>
          {canChangeLanguage()
            ? "Choose New Language"
            : `Complete current course to switch`
          }
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderChatView = () => (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.light }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setAppPhase('lesson_overview')} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.chatHeaderText} numberOfLines={1}>{activeLessonTitle}</Text>
        <View style={{ width: 28 }} />
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        style={styles.chatList}
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={[styles.message, item.role === "user" ? styles.user : styles.assistant]}
          >
            <Text style={item.role === "user" ? styles.userText : styles.assistantText}>{item.text}</Text>
          </MotiView>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      {loading && <ActivityIndicator style={{ marginVertical: 10 }} color={COLORS.primary} />}
      <View style={styles.chatFooter}>
        <TouchableOpacity style={styles.completeButton} onPress={handleCompleteLesson}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
          <Text style={styles.bigButtonText}>Mark Lesson Complete</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your answer or question..."
          placeholderTextColor={COLORS.grey}
        />
        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessageToPython(input)} disabled={!input.trim()}>
          <Ionicons name="send" size={24} color={!input.trim() ? COLORS.grey : COLORS.primary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderContent = () => {
    switch (appPhase) {
      case 'language_selection': return renderLanguageSelection();
      case 'lesson_overview': return renderLessonOverview();
      case 'chat_active': return renderChatView();
      case 'loading':
      default: return renderLoadingView();
    }
  };

  return (<SafeAreaView style={styles.container}>{renderContent()}</SafeAreaView>);
}

// --- StyleSheet ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E8C7',
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  centerScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  overviewContainer: {
    flex: 1,
    backgroundColor: '#F5E8C7',
  },
  overviewHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.dark, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#546E7A', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  loadingText: { marginTop: 12, color: COLORS.dark, fontSize: 16, fontWeight: '600' },
  cardContainer: { width: '100%', marginBottom: 20 },

  // Progress Indicator Styles
  progressContainer: { marginTop: 10, padding: 16, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 16 },
  progressText: { fontSize: 14, color: COLORS.dark, fontWeight: '600' },
  progressBar: { height: 10, backgroundColor: '#E0E0E0', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 5 },
  completedText: { fontSize: 14, color: COLORS.success, textAlign: 'center', marginTop: 12, fontWeight: '700' },

  langCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  langCardSelected: { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: '#FFFDF5' },
  langCardText: { fontSize: 18, fontWeight: '600', color: COLORS.dark },
  langCardTextSelected: { color: COLORS.primary, fontWeight: '700' },

  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  lessonCardLocked: { backgroundColor: 'rgba(255,255,255,0.6)', shadowOpacity: 0 },
  lessonCardCurrent: { backgroundColor: COLORS.dark, transform: [{ scale: 1.02 }] },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  lessonCardTextContainer: { flex: 1, marginLeft: 16 },
  lessonCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.dark, marginBottom: 4 },
  lessonCardTitleAlt: { color: COLORS.white },
  lessonCardStatusComplete: { fontSize: 12, color: COLORS.success, fontWeight: '700', textTransform: 'uppercase' },
  lessonCardStatusCurrent: { fontSize: 12, color: COLORS.primary, fontWeight: '700', textTransform: 'uppercase' },
  lessonCardStatusLocked: { fontSize: 12, color: '#90A4AE', fontWeight: '500' },

  bigButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    width: '100%'
  },
  bigButtonText: { color: COLORS.dark, fontSize: 18, fontWeight: '700' },
  disabledButton: { backgroundColor: '#E0E0E0', shadowOpacity: 0 },

  resetButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 24 },
  resetButtonText: { color: COLORS.danger, marginLeft: 8, fontWeight: '600' },
  disabledResetButton: { opacity: 0.5 },
  disabledResetText: { color: COLORS.grey },

  completeButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  chatHeaderText: { fontSize: 18, fontWeight: '700', color: COLORS.dark, flex: 1, textAlign: 'center' },
  backButton: { padding: 4 },
  chatList: { flex: 1, paddingHorizontal: 16 },
  chatFooter: { padding: 16, backgroundColor: COLORS.light },

  message: { marginVertical: 6, padding: 16, borderRadius: 20, maxWidth: "85%" },
  user: { backgroundColor: COLORS.dark, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  assistant: { backgroundColor: COLORS.white, alignSelf: "flex-start", borderBottomLeftRadius: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  userText: { color: COLORS.white, fontSize: 16, lineHeight: 24 },
  assistantText: { color: COLORS.dark, fontSize: 16, lineHeight: 24 },

  inputContainer: { flexDirection: "row", padding: 12, backgroundColor: COLORS.white, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  input: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 20, marginRight: 12, fontSize: 16, color: COLORS.dark },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
});