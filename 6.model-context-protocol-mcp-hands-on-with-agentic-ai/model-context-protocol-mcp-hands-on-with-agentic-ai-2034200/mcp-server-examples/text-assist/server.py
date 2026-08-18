from mcp.server.fastmcp import FastMCP
import re
from collections import Counter
from typing import Dict, Optional

# Create an MCP server
mcp = FastMCP("Text Assist")

@mcp.tool()
def count_total_characters(text: str) -> int:
    """
    Count the total number of characters in the provided text.
    
    Args:
        text: The text to analyze
    
    Returns:
        The total number of characters including spaces, punctuation, and symbols
    """
    return len(text)

@mcp.tool()
def count_characters_without_spaces(text: str) -> int:
    """
    Count the number of characters in the provided text, excluding spaces.
    
    Args:
        text: The text to analyze
    
    Returns:
        The number of characters excluding spaces
    """
    return len(text.replace(" ", ""))

@mcp.tool()
def count_words(text: str) -> int:
    """
    Count the number of words in the provided text.
    
    Args:
        text: The text to analyze
    
    Returns:
        The number of words in the text
    """
    # Split by whitespace and filter out empty strings
    words = [word for word in re.split(r'\s+', text) if word]
    return len(words)

@mcp.tool()
def count_specific_letters(text: str, letters: str) -> Dict[str, int]:
    """
    Count occurrences of specific letters in the provided text.
    
    Args:
        text: The text to analyze
        letters: The letter(s) to count (can be a single letter or multiple letters)
    
    Returns:
        A dictionary with letters as keys and their counts as values
    """
    # Convert text to lowercase for case-insensitive counting
    text_lower = text.lower()
    
    # Create a counter for the specified letters
    result = {}
    for letter in letters.lower():
        result[letter] = text_lower.count(letter)
    
    return result

@mcp.tool()
def full_text_analysis(text: str) -> Dict[str, any]:
    """
    Perform a complete analysis of the provided text.
    
    Args:
        text: The text to analyze
    
    Returns:
        A dictionary containing various text statistics
    """
    # Get character counts
    total_chars = count_total_characters(text)
    chars_no_spaces = count_characters_without_spaces(text)
    word_count = count_words(text)
    
    # Get character frequency distribution
    char_freq = dict(Counter(text.lower()))
    
    # Calculate additional statistics
    spaces = total_chars - chars_no_spaces
    
    return {
        "total_characters": total_chars,
        "characters_without_spaces": chars_no_spaces,
        "word_count": word_count,
        "spaces": spaces,
        "character_frequency": char_freq
    }


if __name__ == "__main__":
    # main()
    mcp.run()
