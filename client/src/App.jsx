import { useState, useEffect } from 'react';
import { Box, Container, TextField, Paper, Typography, List, ListItem, ListItemText, IconButton } from '@mui/material';
import { Send, Delete } from '@mui/icons-material';
import axios from 'axios';

function App() {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await axios.get('http://localhost:3000/todos');
      setTodos(response.data);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;

    // Add user message to chat
    setChatHistory(prev => [...prev, { type: 'user', content: message }]);

    try {
      const response = await axios.post('http://localhost:3000/chat', { message });
      setChatHistory(prev => [...prev, { type: 'bot', content: response.data.reply }]);
      
      // Refresh todos after bot response
      fetchTodos();
    } catch (error) {
      console.error('Error sending message:', error);
      setChatHistory(prev => [...prev, { type: 'bot', content: 'Sorry, there was an error processing your request.' }]);
    }

    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Container maxWidth="md" sx={{ height: '100vh', py: 4 }}>
      <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, backgroundColor: 'primary.main', color: 'white' }}>
          <Typography variant="h5">AI Todo Assistant</Typography>
        </Box>

        {/* Chat History */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {chatHistory.map((msg, index) => (
            <Box
              key={index}
              sx={{
                alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.type === 'user' ? 'primary.light' : 'grey.100',
                color: msg.type === 'user' ? 'white' : 'text.primary',
                p: 2,
                borderRadius: 2,
                maxWidth: '80%',
              }}
            >
              <Typography>{msg.content}</Typography>
            </Box>
          ))}
        </Box>

        {/* Todos List */}
        <Paper sx={{ maxHeight: '30%', overflow: 'auto', m: 2 }}>
          <List>
            {todos.map((todo) => (
              <ListItem
                key={todo.id}
                secondaryAction={
                  <IconButton edge="end" aria-label="delete">
                    <Delete />
                  </IconButton>
                }
              >
                <ListItemText primary={todo.todo} />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Input Area */}
        <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            InputProps={{
              endAdornment: (
                <IconButton onClick={handleSend} color="primary">
                  <Send />
                </IconButton>
              ),
            }}
          />
        </Box>
      </Paper>
    </Container>
  );
}

export default App;
