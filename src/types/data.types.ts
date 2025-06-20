export type DataFieldType = 'integer' | 'float' | 'string' | 'boolean';

export type NestedDataMap = {
  [key: string]: DataFieldType | NestedDataMap;
};


export type MetricMeta = {
  type: DataFieldType;
  label?: string;
  unit?: string;
};

export interface ProfileDataPoints {
  [profileType: string]: NestedDataMap;
}

export const trackableProfileData: ProfileDataPoints = {
  general: {
    Profile: {
      numberOfProfileCategories: 'integer',
      profileCompletionPercentage: 'integer',
      numberOfBadges: 'integer',
      numberOfMilestones: 'integer',
      numberOfAchievements: 'integer',
      profileViews: 'integer',
      engagement: {
        numberOfLikes: 'integer',
        numberOfShares: 'integer',
        numberOfComments: 'integer',
        numberOfPosts: 'integer',
        numberOfGroupsJoined: 'integer',
        numberOfEventsAttended: 'integer',
        numberOfMessagesSent: 'integer',
        numberOfMessagesReceived: 'integer',
        numberOfFollowing: 'integer',
      },
      mypts: {
        pointsEarned: 'integer',
        pointsSpent: 'integer',
        pointsRedeemed: 'integer',
        pointsBalance: 'integer',
      },
      LinkedProducts: {
        numberOfProducts: 'integer',
        numberOfActiveProducts: 'integer',
        numberOfSoldProducts: 'integer',
        numberOfReturnedProducts: 'integer',
        numberOfReviewedProducts: 'integer',
      },
      Circles: {
        numberOfConnections: 'integer',
        numberOfAffiliations: 'integer',
        numberOfPendingConnections: 'integer',
        numberOfPendingAffiliations: 'integer',
        numberOfPendingInvitations: 'integer',
        numberOfContacts: 'integer',
      }
    },
    Plans: {
      numberOfPlans: 'integer',
      numberOfActivePlans: 'integer',
      numberOfEvents: 'integer',
      numberOfTasks: 'integer',
      numberOfReminders: 'integer',
      numberOfNotes: 'integer',
      numberOfActiveTasters: 'integer',
      numberOfPendingEvents: 'integer',
      numberOfCancelledEvents: 'integer',
      numberOfCompletedEvents: 'integer',
      numberOfPastEvents: 'integer',
    },
    Vault: {
      numberOfDocuments: 'integer',
      numberOfImages: 'integer',
      numberOfVideos: 'integer',
      numberOfAudioFiles: 'integer',
      numberOfFiles: 'integer',
      amountOfStorageUsed: 'float',
      amountOfStorageAvailable: 'float',
    },
    interaction: {
  totalInteractions: 'integer',
  upcomingInteractions: 'integer',
  completedInteractions: 'integer',
  cancelledInteractions: 'integer',
  autoGeneratedInteractions: 'integer',
  personalInteractions: 'integer',
  workInteractions: 'integer',
  businessInteractions: 'integer',
  networkingInteractions: 'integer',
  inPersonInteractions: 'integer',
  virtualInteractions: 'integer',
  interactionsWithRewards: 'integer',
  interactionsWithReminders: 'integer',
  interactionsWithAttachments: 'integer',
  interactionsWithLocation: 'integer',
  interactionsWithContextualEntity: 'integer',
  mostUsedInteractionMode: 'string',
  uniqueInteractionPartners: 'integer',
  averageDaysBetweenContacts: 'float',
  lastInteractionDate: 'string',
  nextScheduledInteractionDate: 'string'
}

  },

  personal: {
    age: 'integer',
    numberOfFollowers: 'integer',
    numberOfConnections: 'integer',
    numberOfUploadedMedia: 'integer',
    emergencyContacts: 'integer',
    numberOfDevicesLinked: 'integer',
    profileViews: 'integer',
  },

  academic: {
    gpa: 'float',
    numberOfCoursesTaken: 'integer',
    certifications: 'integer',
    languagesSpoken: 'integer',
    awards: 'integer',
    examsTaken: 'integer',
    academicPublications: 'integer',
  },

  professional: {
    yearsOfExperience: 'float',
    projectsCompleted: 'integer',
    endorsementsReceived: 'integer',
    portfolioItems: 'integer',
    industryTags: 'integer',
    clientRatingsAvg: 'float',
  },

  business: {
    productsOrServicesListed: 'integer',
    employeesAdded: 'integer',
    branchLocations: 'integer',
    totalTransactions: 'integer',
    myPtsEarnedSpent: 'float',
    monthlyVisitors: 'integer',
  },

  association: {
    members: 'integer',
    projectsPrograms: 'integer',
    eventsOrganized: 'integer',
    fundsRaisedUsd: 'float',
    documentsUploaded: 'integer',
    votesCast: 'integer',
  },

  family: {
    familyMembers: 'integer',
    sharedEvents: 'integer',
    jointDocuments: 'integer',
    petsOwned: 'integer',
    sharedMedicalAlerts: 'integer',
  },

  pet: {
    ageInYears: 'float',
    vaccinesCompleted: 'integer',
    vetVisits: 'integer',
    medications: 'integer',
    qrScansLostFound: 'integer',
  },

  emergency: {
    medicalConditions: 'integer',
    medications: 'integer',
    allergies: 'integer',
    emergencyContacts: 'integer',
    linkedProviders: 'integer',
  },

  influencer: {
    totalFollowers: 'integer',
    averageEngagementRate: 'float',
    platformsActiveOn: 'integer',
    sponsoredPosts: 'integer',
    brandsPartneredWith: 'integer',
  },

  ecommerce: {
    productsListed: 'integer',
    ordersFulfilled: 'integer',
    activeCoupons: 'integer',
    returnRate: 'float',
    dailySalesUsd: 'float',
  },

  transportation: {
    vehiclesListed: 'integer',
    ridesCompleted: 'integer',
    serviceRatingsAvg: 'float',
    routeCoverageKm: 'float',
    driversLinked: 'integer',
  },

  driver: {
    drivingExperienceYears: 'float',
    ridesCompleted: 'integer',
    riderRatingsAvg: 'float',
    incidentsReported: 'integer',
    vehiclesOperated: 'integer',
  },

  rider: {
    ridesTaken: 'integer',
    favoriteDrivers: 'integer',
    totalFarePaidUsd: 'float',
    walletBalance: 'float',
    ratingsGiven: 'integer',
  },

  event: {
    attendeesRegistered: 'integer',
    ticketsSold: 'integer',
    speakerCount: 'integer',
    sessions: 'integer',
    durationHours: 'float',
  },

  dependent: {
    age: 'float',
    vaccinations: 'integer',
    documentsUploaded: 'integer',
    emergencyContacts: 'integer',
    medicalAppointments: 'integer',
  },

  merchant: {
    productsListed: 'integer',
    transactionsCompleted: 'integer',
    customerReviews: 'integer',
    returnRate: 'float',
    averageOrderValueUsd: 'float',
  },

  team: {
    teamMembers: 'integer',
    sharedProjects: 'integer',
    weeklyCheckIns: 'integer',
    documentsShared: 'integer',
    teamWalletUsd: 'float',
  },

  vendor: {
    eventsAttended: 'integer',
    itemsSold: 'integer',
    reviewsReceived: 'integer',
    serviceCategories: 'integer',
    certificatesUploaded: 'integer',
  },

  provider: {
    servicesOffered: 'integer',
    appointmentsBooked: 'integer',
    locationsCovered: 'integer',
    certifications: 'integer',
    activeClients: 'integer',
  },

  home: {
    rooms: 'integer',
    appliances: 'integer',
    maintenanceTasks: 'integer',
    energyConsumptionKwh: 'float',
    securityAlerts: 'integer',
  },

  artist: {
    artworksUploaded: 'integer',
    exhibitionsParticipated: 'integer',
    artStylesTagged: 'integer',
    galleryFollowers: 'integer',
    commissionsReceived: 'integer',
  },

  sole_proprietor: {
    clientsServed: 'integer',
    servicesListed: 'integer',
    hoursWorked: 'float',
    incomeReported: 'float',
    leadsGenerated: 'integer',
  },

  freelancer: {
    projectsCompleted: 'integer',
    hoursWorked: 'float',
    clientsServed: 'integer',
    ratingsReceived: 'float',
    portfoliosUploaded: 'integer',
  },

  medical: {
    body_temperature: 'float',
    body_weight: 'float',
    body_height: 'float',
    heart_rate: 'float',
    blood_pressure: 'float',
    blood_oxygen: 'float',
    blood_glucose: 'float',
  },

  organization: {
    departments: 'integer',
    employees: 'integer',
    fundingReceivedUsd: 'float',
    campaignsRun: 'integer',
    volunteers: 'integer',
  },

  institution: {
    coursesOffered: 'integer',
    enrolledStudents: 'integer',
    facultyMembers: 'integer',
    accreditationDocs: 'integer',
    annualGraduates: 'integer',
  },

  group: {
    groupMembers: 'integer',
    sharedDocuments: 'integer',
    chatMessages: 'integer',
    meetingsScheduled: 'integer',
    tasksAssigned: 'integer',
  },

  neighborhood: {
    residents: 'integer',
    neighborhoodEvents: 'integer',
    localVendors: 'integer',
    reportsSubmitted: 'integer',
    announcementsMade: 'integer',
  },

  company: {
    departments: 'integer',
    employees: 'integer',
    clientsServed: 'integer',
    projectsCompleted: 'integer',
    yearlyRevenue: 'float',
  },

  community: {
    postsMade: 'integer',
    membersJoined: 'integer',
    subgroups: 'integer',
    contentFlags: 'integer',
    pollsConducted: 'integer',
  },

  job_work: {
    jobTitle: 'string',
    yearsOfExperience: 'float',
    certifications: 'integer',
    skillsAcquired: 'integer',
    projectsCompleted: 'integer',
  },

  dummy: {
    templatesUsed: 'integer',
    usageCount: 'integer',
    linkedUsers: 'integer',
    expirationDate: 'string',
    createdBy: 'string',
  }
};
