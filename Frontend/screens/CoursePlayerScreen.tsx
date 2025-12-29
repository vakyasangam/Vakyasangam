import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    LayoutAnimation,
    UIManager,
    Platform,
    Image,
    Linking
} from 'react-native';
import Video, { OnVideoErrorData } from 'react-native-video';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import api from '../api';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    // Suppress warning in New Architecture
    // UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Type Definitions ---
interface Lesson {
    _id: string;
    title: string;
    videoURL?: string;
    videoUrl?: string;
    duration: number;
    lessonType?: 'video' | 'pdf' | 'youtube' | 'nptel';
    pdfUrl?: string;
    nptelUrl?: string;
}
interface Module { _id: string; title: string; lessons: Lesson[]; }
interface Course { _id: string; title: string; thumbnailURL?: string; instructor: { fullname: string }; modules: Module[]; }
type MainStackParamList = { MainTabs: undefined; CoursePlayer: { courseId: string }; };
type CoursePlayerScreenProps = { route: RouteProp<MainStackParamList, 'CoursePlayer'>; navigation: NativeStackNavigationProp<MainStackParamList, 'CoursePlayer'>; };

// --- Utility Functions ---
const isYouTubeURL = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/i;
    return youtubeRegex.test(url);
};

const isNPTELURL = (url: string): boolean => {
    return url.includes('nptel.ac.in');
};

const getVideoId = (url: string): string => {
    try {
        let videoId = '';
        if (url.includes('youtube.com/watch?v=')) {
            videoId = url.split('v=')[1]?.split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1]?.split('?')[0];
        } else if (url.includes('youtube.com/embed/')) {
            videoId = url.split('embed/')[1]?.split('?')[0];
        }
        return videoId || '';
    } catch (error) {
        return '';
    }
};

// --- Main Component ---
const CoursePlayerScreen = ({ route, navigation }: CoursePlayerScreenProps) => {
    const { courseId } = route.params;

    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
    const [openModuleIds, setOpenModuleIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchCourseContent = async () => {
            try {
                const { data } = await api.get(`/api/${courseId}/content`);
                setCourse(data.course);

                if (data.userProgress?.completedLessons) {
                    setCompletedLessons(new Set(data.userProgress.completedLessons));
                }

                if (data.course?.modules?.length > 0) {
                    setOpenModuleIds(new Set([data.course.modules[0]._id]));
                }
            } catch (error: any) {
                const message = error.response?.status === 403
                    ? "Please enroll in this course to view the content."
                    : "Could not load course content.";
                Alert.alert("Error", message, [{ text: "OK", onPress: () => navigation.goBack() }]);
            } finally {
                setLoading(false);
            }
        };

        fetchCourseContent();
    }, [courseId, navigation]);

    const toggleModule = (moduleId: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenModuleIds(prevIds => {
            const newIds = new Set(prevIds);
            if (newIds.has(moduleId)) { newIds.delete(moduleId); } else { newIds.add(moduleId); }
            return newIds;
        });
    };

    const playFirstLesson = () => {
        if (course?.modules?.[0]?.lessons?.[0]) {
            const firstLesson = course.modules[0].lessons[0];
            setSelectedLesson(firstLesson);
        } else {
            Alert.alert("No Lessons", "This course doesn't have any lessons available yet.");
        }
    };

    const handleLessonPress = (lesson: Lesson) => {
        setSelectedLesson(lesson);
    };

    const markLessonAsComplete = async (lessonId?: string) => {
        const targetLessonId = lessonId || selectedLesson?._id;
        if (!targetLessonId || completedLessons.has(targetLessonId)) return;

        try {
            await api.post('/api/progress/complete-lesson', {
                courseId: course?._id,
                lessonId: targetLessonId,
            });
            setCompletedLessons(prev => new Set(prev).add(targetLessonId));
        } catch (error) {
            console.error("Failed to mark lesson as complete:", error);
        }
    };

    const progressInfo = useMemo(() => {
        if (!course?.modules) return { totalLessons: 0, progressPercentage: 0 };
        const total = course.modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0);
        if (total === 0) return { totalLessons: 0, progressPercentage: 0 };
        const percentage = Math.round((completedLessons.size / total) * 100);
        return { totalLessons: total, progressPercentage: percentage };
    }, [course, completedLessons]);

    // ✅ Get preview content for all lesson types
    const getPreviewContent = () => {
        if (!selectedLesson) return null;

        const videoUrl = selectedLesson.videoURL || selectedLesson.videoUrl || selectedLesson.nptelUrl;

        // NPTEL videos - Use WebView for course pages
        if (selectedLesson.lessonType === 'nptel' || isNPTELURL(videoUrl || '')) {
            return (
                <WebView
                    source={{ uri: videoUrl || '' }}
                    style={styles.videoPlayer}
                    allowsFullscreenVideo={true}
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={styles.webViewLoading}>
                            <ActivityIndicator size="large" color="#2563EB" />
                            <Text style={styles.loadingText}>Loading NPTEL Course...</Text>
                        </View>
                    )}
                    onLoadEnd={() => {
                        setTimeout(() => markLessonAsComplete(), 5000);
                    }}
                    onError={(error) => {
                        console.error('NPTEL WebView Error:', error);
                        Alert.alert("Error", "Failed to load NPTEL course. Please check your internet connection.");
                    }}
                    bounces={false}
                    scrollEnabled={true}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15"
                    mixedContentMode="compatibility"
                />
            );
        }

        // YouTube videos - Using react-native-youtube-iframe
        else if (selectedLesson.lessonType === 'youtube' || (videoUrl && isYouTubeURL(videoUrl))) {
            const videoId = getVideoId(videoUrl || '');
            return (
                <View style={[styles.videoPlayer, { justifyContent: 'center', backgroundColor: '#000' }]}>
                    <YoutubePlayer
                        height={230}
                        play={true}
                        videoId={videoId}
                        onChangeState={(state: string) => {
                            if (state === 'ended') {
                                markLessonAsComplete();
                            }
                        }}
                        webViewProps={{
                            allowsInlineMediaPlayback: true,
                            mediaPlaybackRequiresUserAction: false,
                            originWhitelist: ['*'],
                        }}
                    />
                </View>
            );
        }

        // PDF files
        else if (selectedLesson.lessonType === 'pdf') {
            return (
                <WebView
                    source={{ uri: selectedLesson.pdfUrl || '' }}
                    style={styles.videoPlayer}
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={styles.webViewLoading}>
                            <ActivityIndicator size="large" color="#4A90E2" />
                            <Text style={styles.loadingText}>Loading PDF...</Text>
                        </View>
                    )}
                    onError={(error) => {
                        console.error('PDF WebView Error:', error);
                        Alert.alert("Error", "Failed to load PDF file.");
                    }}
                />
            );
        }

        // Regular videos (Direct URLs - Cloudinary, etc.)
        else if (videoUrl) {
            return (
                <Video
                    source={{ uri: videoUrl }}
                    style={styles.videoPlayer}
                    controls={true}
                    resizeMode="contain"
                    onEnd={() => markLessonAsComplete()}
                    onError={(e: OnVideoErrorData) => console.error("Video Error:", JSON.stringify(e))}
                />
            );
        }

        return (
            <View style={styles.noContentContainer}>
                <Ionicons name="alert-circle-outline" size={60} color="#718096" />
                <Text style={styles.noContentText}>Content not available</Text>
            </View>
        );
    };

    if (loading) {
        return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#4A90E2" /></SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.playerArea}>
                {selectedLesson ? (
                    getPreviewContent()
                ) : (
                    <TouchableOpacity style={styles.thumbnailContainer} onPress={playFirstLesson} activeOpacity={0.8}>
                        <Image
                            source={{ uri: course?.thumbnailURL || 'https://placehold.co/600x400/000000/FFFFFF?text=Course' }}
                            style={styles.thumbnail}
                        />
                        <View style={styles.thumbnailOverlay}>
                            <Ionicons name="play-circle-outline" size={60} color="rgba(255, 255, 255, 0.9)" />
                            <Text style={styles.thumbnailText}>Start Course</Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>

            {/* Fallback for YouTube Restriction (Error 152) */}
            {selectedLesson && (selectedLesson.lessonType === 'youtube' || (selectedLesson.videoURL && isYouTubeURL(selectedLesson.videoURL || '')) || (selectedLesson.videoUrl && isYouTubeURL(selectedLesson.videoUrl || ''))) && (
                <TouchableOpacity
                    style={styles.youtubeFallbackBtn}
                    onPress={() => {
                        const url = selectedLesson.videoURL || selectedLesson.videoUrl || '';
                        if (url) Linking.openURL(url);
                    }}
                >
                    <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                    <Text style={styles.youtubeFallbackText}>Open in YouTube App (if video fails)</Text>
                    <Ionicons name="open-outline" size={18} color="#4A5568" />
                </TouchableOpacity>
            )}

            <ScrollView style={styles.contentContainer}>
                <View style={styles.headerInfo}>
                    <Text style={styles.lessonTitleHeader}>{selectedLesson?.title || course?.title || 'Course Content'}</Text>
                    <Text style={styles.instructor}>by {course?.instructor?.fullname}</Text>

                    <View style={styles.progressWrapper}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressText}>{progressInfo.progressPercentage}% Complete</Text>
                            <Text style={styles.progressDetail}>{completedLessons.size} of {progressInfo.totalLessons} lessons</Text>
                        </View>
                        <View style={styles.progressBarBackground}>
                            <View style={[styles.progressBarForeground, { width: `${progressInfo.progressPercentage}%` }]} />
                        </View>
                    </View>
                </View>

                <Text style={styles.playlistHeader}>Course Playlist</Text>

                {course?.modules.map((module, index) => {
                    const isOpen = openModuleIds.has(module._id);
                    return (
                        <View key={module._id} style={styles.moduleContainer}>
                            <TouchableOpacity style={styles.moduleHeader} onPress={() => toggleModule(module._id)}>
                                <View style={styles.moduleHeaderText}>
                                    <Text style={styles.moduleIndex}>Section {index + 1}</Text>
                                    <Text style={styles.moduleTitle}>{module.title}</Text>
                                </View>
                                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={22} color="#4A5568" />
                            </TouchableOpacity>

                            {isOpen && (
                                <View style={styles.lessonsList}>
                                    {module.lessons.map((lesson: Lesson) => {
                                        const isCompleted = completedLessons.has(lesson._id);
                                        const isSelected = selectedLesson?._id === lesson._id;
                                        const videoUrl = lesson.videoURL || lesson.videoUrl || lesson.nptelUrl;

                                        // Icon based on lesson type
                                        let iconName = "play-circle-outline";
                                        let iconColor = "#718096";

                                        if (isCompleted) {
                                            iconName = "checkmark-circle";
                                            iconColor = "#28a745";
                                        } else if (lesson.lessonType === 'youtube' || (videoUrl && isYouTubeURL(videoUrl))) {
                                            iconName = "logo-youtube";
                                            iconColor = isSelected ? "#FF0000" : "#FF6666";
                                        } else if (lesson.lessonType === 'nptel' || isNPTELURL(videoUrl || '')) {
                                            iconName = "school";
                                            iconColor = isSelected ? "#2563EB" : "#3B82F6";
                                        } else if (lesson.lessonType === 'pdf') {
                                            iconName = "document-text";
                                            iconColor = isSelected ? "#4A90E2" : "#718096";
                                        } else if (isSelected) {
                                            iconName = "play-circle";
                                            iconColor = "#4A90E2";
                                        }

                                        return (
                                            <TouchableOpacity
                                                key={lesson._id}
                                                style={[styles.lessonItem, isSelected && styles.selectedLessonItem]}
                                                onPress={() => handleLessonPress(lesson)}
                                            >
                                                <Ionicons name={iconName} size={26} color={iconColor} />
                                                <View style={styles.lessonInfo}>
                                                    <Text style={[styles.lessonTitle, isSelected && styles.selectedLessonTitle]}>
                                                        {lesson.title}
                                                    </Text>
                                                    {/* Show lesson type indicator */}
                                                    {lesson.lessonType === 'youtube' || (videoUrl && isYouTubeURL(videoUrl)) ? (
                                                        <Text style={styles.lessonTypeIndicator}>YouTube Video</Text>
                                                    ) : lesson.lessonType === 'nptel' || isNPTELURL(videoUrl || '') ? (
                                                        <Text style={styles.lessonTypeIndicator}>NPTEL Course</Text>
                                                    ) : lesson.lessonType === 'pdf' ? (
                                                        <Text style={styles.lessonTypeIndicator}>PDF Document</Text>
                                                    ) : (
                                                        <Text style={styles.lessonTypeIndicator}>Video</Text>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A' // Dark navy background
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0F172A'
    },

    playerArea: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    videoPlayer: { flex: 1 },
    thumbnailContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnail: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    thumbnailOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnailText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 12,
        letterSpacing: 0.5,
    },

    // WebView loading styles
    webViewLoading: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },

    // No content styles
    noContentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1E293B',
    },
    noContentText: {
        fontSize: 16,
        color: '#94A3B8',
        marginTop: 12,
    },

    contentContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    headerInfo: {
        padding: 24,
        backgroundColor: '#1E293B',
        borderBottomWidth: 2,
        borderBottomColor: '#334155',
    },
    lessonTitleHeader: {
        fontSize: 24,
        fontWeight: '800',
        color: '#F1F5F9',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    courseTitle: {
        fontSize: 16,
        color: '#94A3B8',
        marginBottom: 6
    },
    instructor: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
    },

    progressWrapper: {
        marginTop: 20,
        backgroundColor: '#334155',
        padding: 16,
        borderRadius: 12,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    progressText: {
        fontSize: 15,
        color: '#F1F5F9',
        fontWeight: '700'
    },
    progressDetail: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '500',
    },
    progressBarBackground: {
        height: 10,
        backgroundColor: '#475569',
        borderRadius: 20,
        overflow: 'hidden'
    },
    progressBarForeground: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 20,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },

    playlistHeader: {
        fontSize: 20,
        fontWeight: '800',
        color: '#F1F5F9',
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 12,
        letterSpacing: 0.5,
    },
    moduleContainer: {
        backgroundColor: '#1E293B',
        marginHorizontal: 16,
        borderRadius: 16,
        marginBottom: 16,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155',
    },
    moduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        backgroundColor: '#334155',
    },
    moduleHeaderText: {
        flex: 1,
        marginRight: 12
    },
    moduleIndex: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    moduleTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#F1F5F9',
        marginTop: 4,
        letterSpacing: 0.2,
    },

    lessonsList: {
        borderTopWidth: 0,
    },
    lessonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 18,
        backgroundColor: '#1E293B',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    selectedLessonItem: {
        backgroundColor: '#1E40AF',
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },

    // Lesson info container
    lessonInfo: {
        marginLeft: 14,
        flex: 1,
    },
    lessonTitle: {
        fontSize: 16,
        color: '#CBD5E1',
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    selectedLessonTitle: {
        color: '#FFFFFF',
        fontWeight: '700'
    },
    // Lesson type indicator
    lessonTypeIndicator: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 4,
        fontWeight: '500',
    },
    youtubeFallbackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1E293B',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        gap: 10,
    },
    youtubeFallbackText: {
        fontSize: 15,
        color: '#F1F5F9',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
});

export default CoursePlayerScreen;