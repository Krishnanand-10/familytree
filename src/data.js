export const initialNodes = [
  // Generation 1
  {
    id: '1',
    type: 'member',
    position: { x: 400, y: 0 },
    data: { name: 'Martin Janssen', birthYear: 1873, deathYear: 1945, gender: 'male', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
  },
  {
    id: '2',
    type: 'member',
    position: { x: 650, y: 0 },
    data: { name: 'Age Janssen', birthYear: 1883, deathYear: 1959, gender: 'female', imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' },
  },
  
  // Generation 2
  {
    id: '3',
    type: 'member',
    position: { x: 525, y: 200 },
    data: { name: 'Jozef Janssen', birthYear: 1907, deathYear: 1997, gender: 'male', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop' },
  },
  {
    id: '4',
    type: 'member',
    position: { x: 775, y: 200 },
    data: { name: 'Beppie Janssen', birthYear: 1910, deathYear: 1999, gender: 'female', imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
  },

  // Generation 3
  {
    id: '5',
    type: 'member',
    position: { x: 200, y: 400 },
    data: { name: 'Evelyn Westow', birthYear: 1944, gender: 'female', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
  },
  {
    id: '6',
    type: 'member',
    position: { x: 450, y: 400 },
    data: { name: 'Marianne Smith', birthYear: 1956, gender: 'female', imageUrl: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=100&h=100&fit=crop' },
  },
  {
    id: '7',
    type: 'member',
    position: { x: 700, y: 400 },
    data: { name: 'Brian Janssen', birthYear: 1953, gender: 'male', imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
  },
  {
    id: '8',
    type: 'member',
    position: { x: 950, y: 400 },
    data: { name: 'Debra Janssen', birthYear: 1955, gender: 'female', imageUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop' },
  },

  // Generation 4 (Children of Brian and Debra)
  {
    id: '9',
    type: 'member',
    position: { x: 825, y: 600 },
    data: { name: 'Jonathan Smith', birthYear: 1982, gender: 'male', imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop' },
  },
  {
    id: '10',
    type: 'member',
    position: { x: 1075, y: 600 },
    data: { name: 'Laura Smith', birthYear: 1984, gender: 'female', imageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop' },
  },
];

export const initialEdges = [
  // Spouses
  { id: 'e1-2', source: '1', target: '2', sourceHandle: 'spouse-out', targetHandle: 'spouse-in', animated: false, label: 'Married' },
  { id: 'e7-8', source: '7', target: '8', sourceHandle: 'spouse-out', targetHandle: 'spouse-in', animated: false, label: 'Married' },

  // Children
  { id: 'e1-3', source: '1', target: '3', type: 'deletable' },
  { id: 'e2-4', source: '2', target: '4', type: 'deletable' },
  
  { id: 'e3-5', source: '3', target: '5', type: 'deletable' },
  { id: 'e3-6', source: '3', target: '6', type: 'deletable' },
  
  { id: 'e7-9', source: '7', target: '9', type: 'deletable' },
  { id: 'e8-10', source: '8', target: '10', type: 'deletable' },
];
